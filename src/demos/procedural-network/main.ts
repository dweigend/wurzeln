/**
 * Coordinates the procedural WebXR network demo and its render loop.
 * Generation, rendering, scene, and UI own their details and resources; this
 * module owns only mutable demo state and lifecycle ordering.
 */

import './styles.css';

import { Timer } from 'three';
import { FrameMetrics } from '../../lib/frame-metrics.ts';
import { createNetwork } from '../../lib/network-generator.ts';
import type { GeneratedNetwork } from '../../lib/settings.ts';
import { ProceduralNetworkView } from './procedural-network-view.ts';
import { createScene, type ProceduralNetworkScene } from './scene.ts';
import { createDemoUi, type ProceduralNetworkUi } from './ui.ts';

const INITIAL_SEED = 20_260_820;
const STATS_REFRESH_SECONDS = 0.25;

type DemoRuntime = {
  ui: ProceduralNetworkUi;
  sceneContext: ProceduralNetworkScene;
  view: ProceduralNetworkView;
  timer: Timer;
  metrics: FrameMetrics;
  network: GeneratedNetwork;
  seed: number;
  elapsedSeconds: number;
  statsElapsedSeconds: number;
  generationMilliseconds: number;
  paused: boolean;
};

type GeneratedResult = Readonly<{
  network: GeneratedNetwork;
  milliseconds: number;
}>;

function start(): () => void {
  let runtime: DemoRuntime;
  const ui = createDemoUi({
    onRestart: (): void => restartNetwork(runtime),
    onTogglePause: (): void => setPaused(runtime, !runtime.paused),
    onPointCountChange: (pointCount): void => rebuildNetwork(runtime, pointCount),
    onVolumeSizeChange: (sizeMeters): void => updateVolumeSize(runtime, sizeMeters),
  });
  runtime = createRuntime(ui);
  const resize = (): void => resizeRuntime(runtime);
  window.addEventListener('resize', resize);
  resize();
  updateVolumeSize(runtime, ui.getVolumeSizeMeters());
  updateStats(runtime);
  runtime.sceneContext.renderer.setAnimationLoop((timeMilliseconds) => {
    renderFrame(runtime, timeMilliseconds);
  });
  return (): void => disposeRuntime(runtime, resize);
}

function createRuntime(ui: ProceduralNetworkUi): DemoRuntime {
  const sceneContext = createScene(ui.canvas);
  const view = new ProceduralNetworkView(sceneContext.scene);
  const generated = generateTimedNetwork(INITIAL_SEED, ui.getPointCount());
  view.setNetwork(generated.network);
  const timer = new Timer();
  timer.connect(document);
  return {
    ui,
    sceneContext,
    view,
    timer,
    metrics: new FrameMetrics(),
    network: generated.network,
    seed: INITIAL_SEED,
    elapsedSeconds: 0,
    statsElapsedSeconds: STATS_REFRESH_SECONDS,
    generationMilliseconds: generated.milliseconds,
    paused: false,
  };
}

function renderFrame(runtime: DemoRuntime, timeMilliseconds: number): void {
  runtime.timer.update(timeMilliseconds);
  const deltaSeconds = runtime.timer.getDelta();
  if (!runtime.paused) runtime.elapsedSeconds += deltaSeconds;
  runtime.view.update(runtime.elapsedSeconds);
  runtime.sceneContext.controls.update();
  runtime.sceneContext.renderer.render(runtime.sceneContext.scene, runtime.sceneContext.camera);
  runtime.metrics.recordFrame(deltaSeconds);
  runtime.statsElapsedSeconds += deltaSeconds;
  if (runtime.statsElapsedSeconds < STATS_REFRESH_SECONDS) return;
  runtime.statsElapsedSeconds = 0;
  updateStats(runtime);
}

function restartNetwork(runtime: DemoRuntime): void {
  runtime.seed += 1;
  rebuildNetwork(runtime, runtime.ui.getPointCount());
}

function rebuildNetwork(runtime: DemoRuntime, pointCount: number): void {
  const generated = generateTimedNetwork(runtime.seed, pointCount);
  runtime.network = generated.network;
  runtime.generationMilliseconds = generated.milliseconds;
  runtime.elapsedSeconds = 0;
  runtime.view.setNetwork(generated.network);
  updateStats(runtime);
}

function generateTimedNetwork(seed: number, pointCount: number): GeneratedResult {
  const startedAt = performance.now();
  const network = createNetwork({ kind: 'volume', seed, pointCount });
  return { network, milliseconds: performance.now() - startedAt };
}

function updateVolumeSize(runtime: DemoRuntime, sizeMeters: number): void {
  runtime.view.setVolumeSizeMeters(sizeMeters);
  runtime.sceneContext.fitToVolume(sizeMeters);
}

function setPaused(runtime: DemoRuntime, paused: boolean): void {
  runtime.paused = paused;
  runtime.ui.setPaused(paused);
}

function updateStats(runtime: DemoRuntime): void {
  runtime.ui.setStats({
    framesPerSecond: runtime.metrics.averageFramesPerSecond,
    p95Milliseconds: runtime.metrics.p95Milliseconds,
    hyphaCount: runtime.view.stats.hyphaCount,
    reinforcedHyphaCount: runtime.network.reinforcedHyphaCount,
    triangleCount: runtime.view.stats.triangleCount,
    generationMilliseconds: runtime.generationMilliseconds,
  });
}

function resizeRuntime(runtime: DemoRuntime): void {
  runtime.view.setPixelRatio(runtime.sceneContext.resize());
}

function disposeRuntime(runtime: DemoRuntime, resize: () => void): void {
  runtime.sceneContext.renderer.setAnimationLoop(null);
  window.removeEventListener('resize', resize);
  runtime.ui.dispose();
  runtime.timer.dispose();
  runtime.view.dispose();
  runtime.sceneContext.dispose();
}

const dispose = start();
window.addEventListener('pagehide', dispose, { once: true });
