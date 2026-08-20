/**
 * Browser lifecycle and four explicit phases for the landscape mycelium MVP.
 * Expensive topology changes happen on button presses; frames update uniforms.
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
import { LandscapeNetworkView } from './network/landscape-network-view.ts';
import { createSubsurfaceNetwork } from './network/subsurface-network.ts';
import { createHeightField, type HeightField } from './terrain/height-field.ts';
import { TerrainView } from './terrain/terrain-view.ts';
import { loadTreeAsset, type TreeAsset } from './trees/tree-asset.ts';
import { createTreePlacements, type TreePlacement } from './trees/tree-placement.ts';
import { TreeView } from './trees/tree-view.ts';

const INITIAL_SEED = 20_260_820;
const PHASE_DURATION_SECONDS = 1.4;
const STATS_REFRESH_SECONDS = 0.25;
const MAX_PIXEL_RATIO = 1.35;

type DemoPhase = 0 | 1 | 2 | 3 | 4;

type DemoElements = {
  canvas: HTMLCanvasElement;
  sizeSlider: HTMLInputElement;
  sizeValue: HTMLOutputElement;
  treeSlider: HTMLInputElement;
  treeValue: HTMLOutputElement;
  pointSlider: HTMLInputElement;
  pointValue: HTMLOutputElement;
  terrainButton: HTMLButtonElement;
  treeButton: HTMLButtonElement;
  subsurfaceButton: HTMLButtonElement;
  growthButton: HTMLButtonElement;
  resetButton: HTMLButtonElement;
  statusValue: HTMLElement;
  fpsValue: HTMLElement;
  p95Value: HTMLElement;
  treeCountValue: HTMLElement;
  hyphaValue: HTMLElement;
  triangleValue: HTMLElement;
};

type PhaseProgress = {
  terrain: number;
  trees: number;
  subsurface: number;
  growthTime: number;
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
  phase: DemoPhase;
  progress: PhaseProgress;
  field?: HeightField;
  trees: TreePlacement[];
  terrainView?: TerrainView;
  treeView?: TreeView;
  networkView?: LandscapeNetworkView;
  seed: number;
  busy: boolean;
  statsElapsed: number;
};

type DemoHandlers = {
  createTerrain: () => void;
  createTrees: () => void;
  revealSubsurface: () => void;
  growNetwork: () => void;
  reset: () => void;
  updateOutputs: () => void;
  resize: () => void;
};

function start(): () => void {
  const runtime = createRuntime();
  const handlers = createHandlers(runtime);
  addEventListeners(runtime.elements, handlers);
  resizeRuntime(runtime);
  updateOutputs(runtime.elements);
  updateInterface(runtime);
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
    phase: 0,
    progress: { terrain: 0, trees: 0, subsurface: 0, growthTime: -1 },
    trees: [],
    seed: INITIAL_SEED,
    busy: false,
    statsElapsed: STATS_REFRESH_SECONDS,
  };
}

function createHandlers(runtime: DemoRuntime): DemoHandlers {
  return {
    createTerrain: (): void => createTerrain(runtime),
    createTrees: (): void => void createTrees(runtime),
    revealSubsurface: (): void => setPhase(runtime, 3),
    growNetwork: (): void => startGrowth(runtime),
    reset: (): void => resetDemo(runtime),
    updateOutputs: (): void => updateOutputs(runtime.elements),
    resize: (): void => resizeRuntime(runtime),
  };
}

function createTerrain(runtime: DemoRuntime): void {
  if (runtime.phase !== 0 || runtime.busy) return;
  const size = Number(runtime.elements.sizeSlider.value);
  runtime.field = createHeightField({ size, seed: runtime.seed });
  runtime.terrainView = new TerrainView(runtime.scene, runtime.field);
  runtime.phase = 1;
  setParameterLock(runtime.elements, true);
  fitCamera(runtime, size);
  updateInterface(runtime);
}

async function createTrees(runtime: DemoRuntime): Promise<void> {
  if (runtime.phase !== 1 || runtime.progress.terrain < 1 || !runtime.field) return;
  runtime.busy = true;
  updateInterface(runtime);
  try {
    const requestedTrees = Number(runtime.elements.treeSlider.value);
    runtime.trees = createTreePlacements(runtime.field, requestedTrees, runtime.seed + 1);
    const asset = await runtime.treeAsset;
    if (!runtime.busy || runtime.phase !== 1) return;
    runtime.treeView = new TreeView(runtime.scene, asset, runtime.trees);
    createNetwork(runtime);
    runtime.phase = 2;
    void runtime.renderer.compileAsync(runtime.scene, runtime.camera);
  } catch (error) {
    runtime.elements.statusValue.textContent = 'Fehler beim Laden';
    console.error(error);
  } finally {
    runtime.busy = false;
    updateInterface(runtime);
  }
}

function createNetwork(runtime: DemoRuntime): void {
  if (!runtime.field) return;
  const points = Number(runtime.elements.pointSlider.value);
  const generated = createSubsurfaceNetwork(runtime.field, runtime.trees, points, runtime.seed + 2);
  runtime.networkView = new LandscapeNetworkView(runtime.scene, runtime.field, generated.network);
}

function setPhase(runtime: DemoRuntime, phase: DemoPhase): void {
  if (runtime.busy || phase !== runtime.phase + 1) return;
  runtime.phase = phase;
  updateInterface(runtime);
}

function startGrowth(runtime: DemoRuntime): void {
  if (runtime.phase !== 3 || runtime.progress.subsurface < 1) return;
  runtime.progress.growthTime = 0;
  setPhase(runtime, 4);
}

function renderFrame(runtime: DemoRuntime, timeMilliseconds: number): void {
  runtime.timer.update(timeMilliseconds);
  const deltaSeconds = Math.min(0.1, runtime.timer.getDelta());
  updatePhaseProgress(runtime, deltaSeconds);
  runtime.controls.update();
  runtime.renderer.render(runtime.scene, runtime.camera);
  runtime.metrics.add(deltaSeconds);
  runtime.statsElapsed += deltaSeconds;
  if (runtime.statsElapsed < STATS_REFRESH_SECONDS) return;
  runtime.statsElapsed = 0;
  updateStats(runtime);
  updateInterface(runtime);
}

function updatePhaseProgress(runtime: DemoRuntime, deltaSeconds: number): void {
  const increment = deltaSeconds / PHASE_DURATION_SECONDS;
  if (runtime.phase >= 1) {
    runtime.progress.terrain = approachOne(runtime.progress.terrain, increment);
  }
  if (runtime.phase >= 2) runtime.progress.trees = approachOne(runtime.progress.trees, increment);
  if (runtime.phase >= 3) {
    runtime.progress.subsurface = approachOne(runtime.progress.subsurface, increment);
  }
  if (runtime.phase >= 4) runtime.progress.growthTime += deltaSeconds;
  runtime.terrainView?.setTerrainReveal(runtime.progress.terrain);
  runtime.terrainView?.setSubsurfaceReveal(runtime.progress.subsurface);
  runtime.treeView?.setReveal(runtime.progress.trees);
  runtime.networkView?.setGrowthTime(runtime.progress.growthTime);
}

function approachOne(value: number, increment: number): number {
  return Math.min(1, value + increment);
}

function resetDemo(runtime: DemoRuntime): void {
  runtime.busy = false;
  runtime.terrainView?.dispose(runtime.scene);
  runtime.treeView?.dispose(runtime.scene);
  runtime.networkView?.dispose(runtime.scene);
  runtime.terrainView = undefined;
  runtime.treeView = undefined;
  runtime.networkView = undefined;
  runtime.field = undefined;
  runtime.trees = [];
  runtime.phase = 0;
  runtime.progress = { terrain: 0, trees: 0, subsurface: 0, growthTime: -1 };
  runtime.seed += 1;
  setParameterLock(runtime.elements, false);
  updateInterface(runtime);
  updateStats(runtime);
}

function updateInterface(runtime: Readonly<DemoRuntime>): void {
  const { elements, phase, progress, busy } = runtime;
  elements.terrainButton.disabled = phase !== 0 || busy;
  elements.treeButton.disabled = phase !== 1 || progress.terrain < 1 || busy;
  elements.subsurfaceButton.disabled = phase !== 2 || progress.trees < 1 || busy;
  elements.growthButton.disabled = phase !== 3 || progress.subsurface < 1 || busy;
  elements.statusValue.textContent = busy ? 'Erzeuge Netzwerk …' : phaseLabel(phase);
}

function phaseLabel(phase: DemoPhase): string {
  return ['Bereit', 'Landschaft', 'Bäume', 'Boden offen', 'Myzel wächst'][phase] ?? 'Bereit';
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

function setParameterLock(elements: Readonly<DemoElements>, locked: boolean): void {
  elements.sizeSlider.disabled = locked;
  elements.treeSlider.disabled = locked;
  elements.pointSlider.disabled = locked;
}

function addEventListeners(elements: DemoElements, handlers: DemoHandlers): void {
  elements.terrainButton.addEventListener('click', handlers.createTerrain);
  elements.treeButton.addEventListener('click', handlers.createTrees);
  elements.subsurfaceButton.addEventListener('click', handlers.revealSubsurface);
  elements.growthButton.addEventListener('click', handlers.growNetwork);
  elements.resetButton.addEventListener('click', handlers.reset);
  elements.sizeSlider.addEventListener('input', handlers.updateOutputs);
  elements.treeSlider.addEventListener('input', handlers.updateOutputs);
  elements.pointSlider.addEventListener('input', handlers.updateOutputs);
  window.addEventListener('resize', handlers.resize);
}

function removeEventListeners(elements: DemoElements, handlers: DemoHandlers): void {
  elements.terrainButton.removeEventListener('click', handlers.createTerrain);
  elements.treeButton.removeEventListener('click', handlers.createTrees);
  elements.subsurfaceButton.removeEventListener('click', handlers.revealSubsurface);
  elements.growthButton.removeEventListener('click', handlers.growNetwork);
  elements.resetButton.removeEventListener('click', handlers.reset);
  elements.sizeSlider.removeEventListener('input', handlers.updateOutputs);
  elements.treeSlider.removeEventListener('input', handlers.updateOutputs);
  elements.pointSlider.removeEventListener('input', handlers.updateOutputs);
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

function disposeRuntime(runtime: DemoRuntime, handlers: DemoHandlers): void {
  runtime.renderer.setAnimationLoop(null);
  removeEventListeners(runtime.elements, handlers);
  runtime.terrainView?.dispose(runtime.scene);
  runtime.treeView?.dispose(runtime.scene);
  runtime.networkView?.dispose(runtime.scene);
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
    terrainButton: requireElement('#terrain-button'),
    treeButton: requireElement('#tree-button'),
    subsurfaceButton: requireElement('#subsurface-button'),
    growthButton: requireElement('#growth-button'),
    resetButton: requireElement('#reset-button'),
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
