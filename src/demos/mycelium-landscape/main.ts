/**
 * Live layer controls and regeneration lifecycle for the landscape mycelium MVP.
 * Sliders rebuild immutable world data; render frames only draw and collect metrics.
 */

import './styles.css';

import {
  Color,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Timer,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { FrameMetrics } from '../procedural-network/frame-metrics.ts';
import type { GeneratedNetwork } from '../procedural-network/network/network-generator.ts';
import { LandscapeNetworkView } from './network/landscape-network-view.ts';
import { createSubsurfaceNetwork } from './network/subsurface-network.ts';
import { createHeightField, type HeightField } from './terrain/height-field.ts';
import { TerrainView } from './terrain/terrain-view.ts';
import { loadTreeAsset, type TreeAsset } from './trees/tree-asset.ts';
import { createTreePlacements, type TreePlacement } from './trees/tree-placement.ts';
import { TreeView } from './trees/tree-view.ts';

const INITIAL_SEED = 20_260_820;
const STATS_REFRESH_SECONDS = 0.25;
const MAX_PIXEL_RATIO = 1.35;
const NETWORK_SEQUENCE_SECONDS = 20;

type DemoElements = {
  canvas: HTMLCanvasElement;
  sizeSlider: HTMLInputElement;
  sizeValue: HTMLOutputElement;
  treeSlider: HTMLInputElement;
  treeValue: HTMLOutputElement;
  pointSlider: HTMLInputElement;
  pointValue: HTMLOutputElement;
  terrainToggle: HTMLInputElement;
  treeToggle: HTMLInputElement;
  subsurfaceToggle: HTMLInputElement;
  networkToggle: HTMLInputElement;
  growNetworkButton: HTMLButtonElement;
  newLandscapeButton: HTMLButtonElement;
  statusValue: HTMLElement;
  fpsValue: HTMLElement;
  p95Value: HTMLElement;
  treeCountValue: HTMLElement;
  hyphaValue: HTMLElement;
  triangleValue: HTMLElement;
};

type DemoRuntime = {
  elements: DemoElements;
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  controls: OrbitControls;
  timer: Timer;
  metrics: FrameMetrics;
  vrButton: HTMLElement;
  treeAsset: Promise<TreeAsset>;
  terrainView?: TerrainView;
  treeView?: TreeView;
  networkView?: LandscapeNetworkView;
  trees: TreePlacement[];
  seed: number;
  generation: number;
  rebuildFrame?: number;
  fitCameraAfterRebuild: boolean;
  growthTime: number;
  busy: boolean;
  statsElapsed: number;
};

type WorldBuild = {
  field: HeightField;
  trees: TreePlacement[];
  network: GeneratedNetwork;
  asset: TreeAsset;
};

type DemoHandlers = {
  updateSize: () => void;
  updateContents: () => void;
  updateLayers: () => void;
  growNetwork: () => void;
  createNewLandscape: () => void;
  resize: () => void;
};

function start(): () => void {
  const runtime = createRuntime();
  const handlers = createHandlers(runtime);
  addEventListeners(runtime.elements, handlers);
  resizeRuntime(runtime);
  updateOutputs(runtime.elements);
  scheduleWorldRebuild(runtime, true);
  runtime.renderer.setAnimationLoop((time) => renderFrame(runtime, time));
  return (): void => disposeRuntime(runtime, handlers);
}

function createRuntime(): DemoRuntime {
  const elements = getDemoElements();
  const scene = new Scene();
  scene.background = new Color('#0e0913');
  const camera = createCamera();
  const renderer = createRenderer(elements.canvas);
  const controls = createControls(camera, elements.canvas);
  const timer = new Timer();
  timer.connect(document);
  const vrButton = VRButton.createButton(renderer);
  document.body.appendChild(vrButton);

  return {
    elements,
    scene,
    camera,
    renderer,
    controls,
    timer,
    metrics: new FrameMetrics(),
    vrButton,
    treeAsset: loadTreeAsset(),
    trees: [],
    seed: INITIAL_SEED,
    generation: 0,
    fitCameraAfterRebuild: false,
    growthTime: NETWORK_SEQUENCE_SECONDS,
    busy: false,
    statsElapsed: STATS_REFRESH_SECONDS,
  };
}

function createHandlers(runtime: DemoRuntime): DemoHandlers {
  return {
    updateSize: (): void => updateConfiguration(runtime, true),
    updateContents: (): void => updateConfiguration(runtime, false),
    updateLayers: (): void => applyLayerVisibility(runtime),
    growNetwork: (): void => growNetwork(runtime),
    createNewLandscape: (): void => createNewLandscape(runtime),
    resize: (): void => resizeRuntime(runtime),
  };
}

function updateConfiguration(runtime: DemoRuntime, fitCamera: boolean): void {
  updateOutputs(runtime.elements);
  scheduleWorldRebuild(runtime, fitCamera);
}

function createNewLandscape(runtime: DemoRuntime): void {
  runtime.seed += 1;
  scheduleWorldRebuild(runtime, false);
}

function growNetwork(runtime: DemoRuntime): void {
  runtime.growthTime = 0;
  runtime.elements.networkToggle.checked = true;
  applyLayerVisibility(runtime);
  runtime.networkView?.setGrowthTime(runtime.growthTime);
}

function scheduleWorldRebuild(runtime: DemoRuntime, fitCamera: boolean): void {
  runtime.generation += 1;
  runtime.fitCameraAfterRebuild ||= fitCamera;
  if (runtime.rebuildFrame !== undefined) return;
  runtime.rebuildFrame = requestAnimationFrame(() => {
    runtime.rebuildFrame = undefined;
    const shouldFitCamera = runtime.fitCameraAfterRebuild;
    runtime.fitCameraAfterRebuild = false;
    void rebuildWorld(runtime, shouldFitCamera);
  });
}

async function rebuildWorld(runtime: DemoRuntime, shouldFitCamera: boolean): Promise<void> {
  const generation = runtime.generation + 1;
  runtime.generation = generation;
  runtime.busy = true;
  updateStatus(runtime);
  const size = Number(runtime.elements.sizeSlider.value);
  let failed = false;

  try {
    const build = await generateWorld(runtime, size);
    if (generation !== runtime.generation) return;
    replaceWorld(runtime, build);
    if (shouldFitCamera) fitCamera(runtime, size);
  } catch (error) {
    if (generation !== runtime.generation) return;
    failed = true;
    console.error(error);
  } finally {
    if (generation !== runtime.generation) return;
    runtime.busy = false;
    runtime.elements.statusValue.textContent = failed ? 'Fehler' : 'Live';
    updateStats(runtime);
  }
}

async function generateWorld(runtime: DemoRuntime, size: number): Promise<WorldBuild> {
  const field = createHeightField({ size, seed: runtime.seed });
  const treeCount = Number(runtime.elements.treeSlider.value);
  const trees = createTreePlacements(field, treeCount, runtime.seed + 1);
  const pointCount = Number(runtime.elements.pointSlider.value);
  const network = createSubsurfaceNetwork(field, trees, pointCount, runtime.seed + 2).network;
  const asset = await runtime.treeAsset;
  return { field, trees, network, asset };
}

function replaceWorld(runtime: DemoRuntime, build: Readonly<WorldBuild>): void {
  disposeWorld(runtime);
  runtime.trees = build.trees;
  runtime.terrainView = new TerrainView(runtime.scene, build.field);
  runtime.treeView = new TreeView(runtime.scene, build.asset, build.trees);
  runtime.networkView = new LandscapeNetworkView(runtime.scene, build.field, build.network);
  runtime.networkView.setGrowthTime(runtime.growthTime);
  applyLayerVisibility(runtime);
}

function applyLayerVisibility(runtime: DemoRuntime): void {
  runtime.terrainView?.setVisible(runtime.elements.terrainToggle.checked);
  runtime.terrainView?.setSubsurfaceVisible(runtime.elements.subsurfaceToggle.checked);
  runtime.treeView?.setVisible(runtime.elements.treeToggle.checked);
  runtime.networkView?.setVisible(runtime.elements.networkToggle.checked);
}

function renderFrame(runtime: DemoRuntime, timeMilliseconds: number): void {
  runtime.timer.update(timeMilliseconds);
  const deltaSeconds = Math.min(0.1, runtime.timer.getDelta());
  runtime.growthTime = Math.min(NETWORK_SEQUENCE_SECONDS, runtime.growthTime + deltaSeconds);
  runtime.networkView?.setGrowthTime(runtime.growthTime);
  runtime.controls.update();
  runtime.renderer.render(runtime.scene, runtime.camera);
  runtime.metrics.add(deltaSeconds);
  runtime.statsElapsed += deltaSeconds;
  if (runtime.statsElapsed < STATS_REFRESH_SECONDS) return;
  runtime.statsElapsed = 0;
  updateStats(runtime);
}

function updateStatus(runtime: Readonly<DemoRuntime>): void {
  runtime.elements.statusValue.textContent = runtime.busy ? 'Aktualisiere …' : 'Live';
}

function updateStats(runtime: Readonly<DemoRuntime>): void {
  runtime.elements.fpsValue.textContent = formatNumber(runtime.metrics.averageFramesPerSecond);
  runtime.elements.p95Value.textContent = `${formatNumber(runtime.metrics.p95Milliseconds)} ms`;
  runtime.elements.treeCountValue.textContent = formatInteger(runtime.trees.length);
  runtime.elements.hyphaValue.textContent = formatInteger(runtime.networkView?.hyphaCount ?? 0);
  runtime.elements.triangleValue.textContent = formatInteger(
    runtime.renderer.info.render.triangles,
  );
}

function updateOutputs(elements: Readonly<DemoElements>): void {
  elements.sizeValue.value = `${elements.sizeSlider.value} m`;
  elements.treeValue.value = elements.treeSlider.value;
  elements.pointValue.value = elements.pointSlider.value;
}

function addEventListeners(elements: DemoElements, handlers: DemoHandlers): void {
  elements.sizeSlider.addEventListener('input', handlers.updateSize);
  elements.treeSlider.addEventListener('input', handlers.updateContents);
  elements.pointSlider.addEventListener('input', handlers.updateContents);
  elements.terrainToggle.addEventListener('change', handlers.updateLayers);
  elements.treeToggle.addEventListener('change', handlers.updateLayers);
  elements.subsurfaceToggle.addEventListener('change', handlers.updateLayers);
  elements.networkToggle.addEventListener('change', handlers.updateLayers);
  elements.growNetworkButton.addEventListener('click', handlers.growNetwork);
  elements.newLandscapeButton.addEventListener('click', handlers.createNewLandscape);
  window.addEventListener('resize', handlers.resize);
}

function removeEventListeners(elements: DemoElements, handlers: DemoHandlers): void {
  elements.sizeSlider.removeEventListener('input', handlers.updateSize);
  elements.treeSlider.removeEventListener('input', handlers.updateContents);
  elements.pointSlider.removeEventListener('input', handlers.updateContents);
  elements.terrainToggle.removeEventListener('change', handlers.updateLayers);
  elements.treeToggle.removeEventListener('change', handlers.updateLayers);
  elements.subsurfaceToggle.removeEventListener('change', handlers.updateLayers);
  elements.networkToggle.removeEventListener('change', handlers.updateLayers);
  elements.growNetworkButton.removeEventListener('click', handlers.growNetwork);
  elements.newLandscapeButton.removeEventListener('click', handlers.createNewLandscape);
  window.removeEventListener('resize', handlers.resize);
}

function createCamera(): PerspectiveCamera {
  const camera = new PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.05, 180);
  camera.position.set(22, 16, 22);
  return camera;
}

function createRenderer(canvas: HTMLCanvasElement): WebGLRenderer {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.xr.enabled = true;
  renderer.xr.setFramebufferScaleFactor(0.9);
  return renderer;
}

function createControls(camera: PerspectiveCamera, canvas: HTMLCanvasElement): OrbitControls {
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.target.set(0, 0, 0);
  controls.update();
  return controls;
}

function fitCamera(runtime: DemoRuntime, size: number): void {
  const direction = new Vector3(1, 0.72, 1).normalize();
  runtime.camera.position.copy(direction.multiplyScalar(size * 1.15));
  runtime.controls.minDistance = size * 0.35;
  runtime.controls.maxDistance = size * 3;
  runtime.controls.update();
}

function resizeRuntime(runtime: DemoRuntime): void {
  const pixelRatio = Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO);
  runtime.camera.aspect = window.innerWidth / window.innerHeight;
  runtime.camera.updateProjectionMatrix();
  runtime.renderer.setPixelRatio(pixelRatio);
  runtime.renderer.setSize(window.innerWidth, window.innerHeight, false);
}

function disposeWorld(runtime: DemoRuntime): void {
  runtime.terrainView?.dispose(runtime.scene);
  runtime.treeView?.dispose(runtime.scene);
  runtime.networkView?.dispose(runtime.scene);
  runtime.terrainView = undefined;
  runtime.treeView = undefined;
  runtime.networkView = undefined;
  runtime.trees = [];
}

function disposeRuntime(runtime: DemoRuntime, handlers: DemoHandlers): void {
  runtime.generation += 1;
  if (runtime.rebuildFrame !== undefined) cancelAnimationFrame(runtime.rebuildFrame);
  runtime.renderer.setAnimationLoop(null);
  removeEventListeners(runtime.elements, handlers);
  disposeWorld(runtime);
  void runtime.treeAsset.then((asset) => asset.dispose());
  runtime.timer.dispose();
  runtime.controls.dispose();
  runtime.renderer.dispose();
  runtime.vrButton.remove();
}

function getDemoElements(): DemoElements {
  return {
    canvas: requireElement('#scene'),
    sizeSlider: requireElement('#size-slider'),
    sizeValue: requireElement('#size-value'),
    treeSlider: requireElement('#tree-slider'),
    treeValue: requireElement('#tree-value'),
    pointSlider: requireElement('#point-slider'),
    pointValue: requireElement('#point-value'),
    terrainToggle: requireElement('#terrain-toggle'),
    treeToggle: requireElement('#tree-toggle'),
    subsurfaceToggle: requireElement('#subsurface-toggle'),
    networkToggle: requireElement('#network-toggle'),
    growNetworkButton: requireElement('#grow-network-button'),
    newLandscapeButton: requireElement('#new-landscape-button'),
    statusValue: requireElement('#status-value'),
    fpsValue: requireElement('#fps-value'),
    p95Value: requireElement('#p95-value'),
    treeCountValue: requireElement('#tree-count-value'),
    hyphaValue: requireElement('#hypha-value'),
    triangleValue: requireElement('#triangle-value'),
  };
}

function requireElement<ElementType extends Element>(selector: string): ElementType {
  const element = document.querySelector<ElementType>(selector);
  if (!element) throw new Error(`Required element not found: ${selector}`);
  return element;
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(value);
}

const dispose = start();
window.addEventListener('pagehide', dispose, { once: true });
