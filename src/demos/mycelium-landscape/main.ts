/**
 * Coordinates landscape generation, layer adapters, and the WebXR render loop.
 * World data is replaced atomically; scene, UI, and views own their resources
 * while this module owns request ordering and mutable demo state.
 */

import './styles.css';

import { Timer } from 'three';
import { FrameMetrics } from '../../lib/frame-metrics.ts';
import type { GeneratedNetwork } from '../../lib/settings.ts';
import { LandscapeNetworkView } from './network/landscape-network-view.ts';
import { createSubsurfaceNetwork } from './network/subsurface-network.ts';
import { createScene, type LandscapeScene } from './scene.ts';
import { createHeightField, type HeightField } from './terrain/height-field.ts';
import { TerrainView } from './terrain/terrain-view.ts';
import { loadTreeAsset, type TreeAsset } from './trees/tree-asset.ts';
import { createTreePlacements, type TreePlacement } from './trees/tree-placement.ts';
import { TreeView } from './trees/tree-view.ts';
import { createDemoUi, type LandscapeUi } from './ui.ts';

const INITIAL_SEED = 20_260_820;
const STATS_REFRESH_SECONDS = 0.25;
const NETWORK_SEQUENCE_SECONDS = 20;

type DemoRuntime = {
  ui: LandscapeUi;
  sceneContext: LandscapeScene;
  timer: Timer;
  metrics: FrameMetrics;
  treeAsset: Promise<TreeAsset>;
  terrainView?: TerrainView;
  treeView?: TreeView;
  networkView?: LandscapeNetworkView;
  trees: readonly TreePlacement[];
  seed: number;
  generation: number;
  rebuildFrame?: number;
  fitCameraAfterRebuild: boolean;
  growthTimeSeconds: number;
  statsElapsedSeconds: number;
};

type WorldBuild = Readonly<{
  field: HeightField;
  trees: readonly TreePlacement[];
  network: GeneratedNetwork;
  asset: TreeAsset;
}>;

function start(): () => void {
  let runtime: DemoRuntime;
  const ui = createDemoUi({
    onSizeChange: (): void => updateConfiguration(runtime, true),
    onContentsChange: (): void => updateConfiguration(runtime, false),
    onLayersChange: (): void => applyLayerVisibility(runtime),
    onGrowNetwork: (): void => growNetwork(runtime),
    onNewLandscape: (): void => createNewLandscape(runtime),
  });
  runtime = createRuntime(ui);
  const resize = (): void => runtime.sceneContext.resize();
  window.addEventListener('resize', resize);
  resize();
  scheduleWorldRebuild(runtime, true);
  runtime.sceneContext.renderer.setAnimationLoop((timeMilliseconds) => {
    renderFrame(runtime, timeMilliseconds);
  });
  return (): void => disposeRuntime(runtime, resize);
}

function createRuntime(ui: LandscapeUi): DemoRuntime {
  const timer = new Timer();
  timer.connect(document);
  return {
    ui,
    sceneContext: createScene(ui.canvas),
    timer,
    metrics: new FrameMetrics(),
    treeAsset: loadTreeAsset(),
    trees: [],
    seed: INITIAL_SEED,
    generation: 0,
    fitCameraAfterRebuild: false,
    growthTimeSeconds: NETWORK_SEQUENCE_SECONDS,
    statsElapsedSeconds: STATS_REFRESH_SECONDS,
  };
}

function updateConfiguration(runtime: DemoRuntime, fitCamera: boolean): void {
  scheduleWorldRebuild(runtime, fitCamera);
}

function createNewLandscape(runtime: DemoRuntime): void {
  runtime.seed += 1;
  scheduleWorldRebuild(runtime, false);
}

function growNetwork(runtime: DemoRuntime): void {
  runtime.growthTimeSeconds = 0;
  runtime.ui.showNetwork();
  applyLayerVisibility(runtime);
  runtime.networkView?.setGrowthTime(runtime.growthTimeSeconds);
}

function scheduleWorldRebuild(runtime: DemoRuntime, fitCamera: boolean): void {
  runtime.generation += 1;
  runtime.fitCameraAfterRebuild ||= fitCamera;
  if (runtime.rebuildFrame !== undefined) return;
  runtime.rebuildFrame = requestAnimationFrame(() => runScheduledRebuild(runtime));
}

function runScheduledRebuild(runtime: DemoRuntime): void {
  runtime.rebuildFrame = undefined;
  const shouldFitCamera = runtime.fitCameraAfterRebuild;
  runtime.fitCameraAfterRebuild = false;
  void rebuildWorld(runtime, shouldFitCamera);
}

async function rebuildWorld(runtime: DemoRuntime, shouldFitCamera: boolean): Promise<void> {
  const requestId = runtime.generation + 1;
  runtime.generation = requestId;
  runtime.ui.setStatus('Aktualisiere …');

  try {
    const build = await createWorldBuild(runtime);
    if (requestId !== runtime.generation) return;
    replaceWorld(runtime, build);
    if (shouldFitCamera) runtime.sceneContext.fitToLandscape(build.field.sizeMeters);
    finishWorldRebuild(runtime, 'Live');
  } catch (error) {
    if (requestId !== runtime.generation) return;
    console.error(error);
    finishWorldRebuild(runtime, 'Fehler');
  }
}

async function createWorldBuild(runtime: DemoRuntime): Promise<WorldBuild> {
  const settings = runtime.ui.getSettings();
  const field = createHeightField({ sizeMeters: settings.sizeMeters, seed: runtime.seed });
  const trees = createTreePlacements(field, settings.treeCount, runtime.seed + 1);
  const network = createSubsurfaceNetwork(
    field,
    trees,
    settings.pointCount,
    runtime.seed + 2,
  );
  return { field, trees, network, asset: await runtime.treeAsset };
}

function finishWorldRebuild(runtime: DemoRuntime, status: 'Fehler' | 'Live'): void {
  runtime.ui.setStatus(status);
  updateStats(runtime);
}

function replaceWorld(runtime: DemoRuntime, build: WorldBuild): void {
  disposeWorld(runtime);
  runtime.trees = build.trees;
  runtime.terrainView = new TerrainView(runtime.sceneContext.scene, build.field);
  runtime.treeView = new TreeView(runtime.sceneContext.scene, build.asset, build.trees);
  runtime.networkView = new LandscapeNetworkView(
    runtime.sceneContext.scene,
    build.field,
    build.network,
  );
  runtime.networkView.setGrowthTime(runtime.growthTimeSeconds);
  applyLayerVisibility(runtime);
}

function applyLayerVisibility(runtime: DemoRuntime): void {
  const visibility = runtime.ui.getLayerVisibility();
  runtime.terrainView?.setVisible(visibility.terrain);
  runtime.terrainView?.setSubsurfaceVisible(visibility.subsurface);
  runtime.treeView?.setVisible(visibility.trees);
  runtime.networkView?.setVisible(visibility.network);
}

function renderFrame(runtime: DemoRuntime, timeMilliseconds: number): void {
  runtime.timer.update(timeMilliseconds);
  const deltaSeconds = Math.min(0.1, runtime.timer.getDelta());
  runtime.growthTimeSeconds = Math.min(
    NETWORK_SEQUENCE_SECONDS,
    runtime.growthTimeSeconds + deltaSeconds,
  );
  runtime.networkView?.setGrowthTime(runtime.growthTimeSeconds);
  runtime.sceneContext.controls.update();
  runtime.sceneContext.renderer.render(runtime.sceneContext.scene, runtime.sceneContext.camera);
  runtime.metrics.recordFrame(deltaSeconds);
  runtime.statsElapsedSeconds += deltaSeconds;
  if (runtime.statsElapsedSeconds < STATS_REFRESH_SECONDS) return;
  runtime.statsElapsedSeconds = 0;
  updateStats(runtime);
}

function updateStats(runtime: DemoRuntime): void {
  runtime.ui.setStats({
    framesPerSecond: runtime.metrics.averageFramesPerSecond,
    p95Milliseconds: runtime.metrics.p95Milliseconds,
    treeCount: runtime.trees.length,
    hyphaCount: runtime.networkView?.hyphaCount ?? 0,
    triangleCount: runtime.sceneContext.renderer.info.render.triangles,
  });
}

function disposeWorld(runtime: DemoRuntime): void {
  runtime.terrainView?.dispose();
  runtime.treeView?.dispose();
  runtime.networkView?.dispose();
  runtime.terrainView = undefined;
  runtime.treeView = undefined;
  runtime.networkView = undefined;
}

function disposeRuntime(runtime: DemoRuntime, resize: () => void): void {
  runtime.generation += 1;
  if (runtime.rebuildFrame !== undefined) cancelAnimationFrame(runtime.rebuildFrame);
  runtime.sceneContext.renderer.setAnimationLoop(null);
  window.removeEventListener('resize', resize);
  runtime.ui.dispose();
  disposeWorld(runtime);
  void runtime.treeAsset.then(
    (asset) => asset.dispose(),
    () => undefined,
  );
  runtime.timer.dispose();
  runtime.sceneContext.dispose();
}

const dispose = start();
window.addEventListener('pagehide', dispose, { once: true });
