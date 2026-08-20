/**
 * Browser lifecycle and controls for the procedural WebGL2 network demo.
 * It regenerates immutable network data on user input while frame updates are
 * limited to camera controls, timing uniforms, rendering, and diagnostics.
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
import { FrameMetrics } from './frame-metrics.ts';
import {
  generateNetwork,
  type GeneratedNetwork,
  MAX_POINT_COUNT,
  MIN_POINT_COUNT,
} from './network/network-generator.ts';
import { ProceduralNetworkView } from './rendering/procedural-network-view.ts';

const INITIAL_SEED = 20_260_820;
const MAX_PIXEL_RATIO = 1.5;
const STATS_REFRESH_SECONDS = 0.25;
const CAMERA_FIELD_OF_VIEW = 48;
const CAMERA_NEAR = 0.05;
const CAMERA_FAR = 180;

type DemoElements = {
  canvas: HTMLCanvasElement;
  volumeSlider: HTMLInputElement;
  volumeValue: HTMLOutputElement;
  pointSlider: HTMLInputElement;
  pointValue: HTMLOutputElement;
  restartButton: HTMLButtonElement;
  pauseButton: HTMLButtonElement;
  fpsValue: HTMLElement;
  p95Value: HTMLElement;
  connectionValue: HTMLElement;
  tendrilValue: HTMLElement;
  triangleValue: HTMLElement;
  generationValue: HTMLElement;
};

type DemoRuntime = {
  elements: DemoElements;
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  controls: OrbitControls;
  view: ProceduralNetworkView;
  timer: Timer;
  metrics: FrameMetrics;
  vrButton: HTMLElement;
  network: GeneratedNetwork;
  seed: number;
  elapsedSeconds: number;
  statsElapsedSeconds: number;
  generationMilliseconds: number;
  paused: boolean;
};

type DemoHandlers = {
  restart: () => void;
  togglePause: () => void;
  previewPointCount: () => void;
  rebuildPointCount: () => void;
  updateVolume: () => void;
  resize: () => void;
};

function start(): () => void {
  const runtime = createRuntime();
  const handlers = createHandlers(runtime);
  addEventListeners(runtime.elements, handlers);
  resizeRuntime(runtime);
  updateVolume(runtime);
  updateStats(runtime);
  runtime.renderer.setAnimationLoop((timeMilliseconds) => renderFrame(runtime, timeMilliseconds));
  return (): void => disposeRuntime(runtime, handlers);
}

function createRuntime(): DemoRuntime {
  const elements = getDemoElements();
  const scene = createScene();
  const camera = createCamera();
  const renderer = createRenderer(elements.canvas);
  const controls = createControls(camera, elements.canvas);
  const view = new ProceduralNetworkView(scene);
  const generated = generateTimedNetwork(INITIAL_SEED, Number(elements.pointSlider.value));
  view.setNetwork(generated.network);

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
    view,
    timer,
    metrics: new FrameMetrics(),
    vrButton,
    network: generated.network,
    seed: INITIAL_SEED,
    elapsedSeconds: 0,
    statsElapsedSeconds: STATS_REFRESH_SECONDS,
    generationMilliseconds: generated.milliseconds,
    paused: false,
  };
}

function createHandlers(runtime: DemoRuntime): DemoHandlers {
  return {
    restart: (): void => restartNetwork(runtime),
    togglePause: (): void => setPaused(runtime, !runtime.paused),
    previewPointCount: (): void => updatePointOutput(runtime),
    rebuildPointCount: (): void => rebuildNetwork(runtime),
    updateVolume: (): void => updateVolume(runtime),
    resize: (): void => resizeRuntime(runtime),
  };
}

function addEventListeners(elements: DemoElements, handlers: DemoHandlers): void {
  elements.restartButton.addEventListener('click', handlers.restart);
  elements.pauseButton.addEventListener('click', handlers.togglePause);
  elements.pointSlider.addEventListener('input', handlers.previewPointCount);
  elements.pointSlider.addEventListener('change', handlers.rebuildPointCount);
  elements.volumeSlider.addEventListener('input', handlers.updateVolume);
  window.addEventListener('resize', handlers.resize);
}

function renderFrame(runtime: DemoRuntime, timeMilliseconds: number): void {
  runtime.timer.update(timeMilliseconds);
  const deltaSeconds = runtime.timer.getDelta();
  if (!runtime.paused) runtime.elapsedSeconds += deltaSeconds;
  runtime.view.update(runtime.elapsedSeconds);
  runtime.controls.update();
  runtime.renderer.render(runtime.scene, runtime.camera);
  runtime.metrics.add(deltaSeconds);
  runtime.statsElapsedSeconds += deltaSeconds;
  if (runtime.statsElapsedSeconds < STATS_REFRESH_SECONDS) return;
  runtime.statsElapsedSeconds = 0;
  updateStats(runtime);
}

function restartNetwork(runtime: DemoRuntime): void {
  runtime.seed += 1;
  rebuildNetwork(runtime);
}

function rebuildNetwork(runtime: DemoRuntime): void {
  const pointCount = Number(runtime.elements.pointSlider.value);
  const generated = generateTimedNetwork(runtime.seed, pointCount);
  runtime.network = generated.network;
  runtime.generationMilliseconds = generated.milliseconds;
  runtime.elapsedSeconds = 0;
  runtime.view.setNetwork(generated.network);
  updatePointOutput(runtime);
  updateStats(runtime);
}

function generateTimedNetwork(
  seed: number,
  pointCount: number,
): { network: GeneratedNetwork; milliseconds: number } {
  const startedAt = performance.now();
  const network = generateNetwork({ seed, pointCount });
  return { network, milliseconds: performance.now() - startedAt };
}

function updateVolume(runtime: DemoRuntime): void {
  const volumeScale = Number(runtime.elements.volumeSlider.value);
  runtime.elements.volumeValue.value = `${formatNumber(volumeScale)} m`;
  runtime.view.setVolumeScale(volumeScale);
  fitCameraToVolume(runtime, volumeScale);
}

function fitCameraToVolume(runtime: DemoRuntime, volumeScale: number): void {
  const direction = runtime.camera.position.clone().sub(runtime.controls.target);
  if (direction.lengthSq() === 0) direction.copy(new Vector3(1, 0.72, 1));
  direction.normalize();
  runtime.camera.position.copy(runtime.controls.target).addScaledVector(direction, volumeScale * 1.65);
  runtime.controls.minDistance = volumeScale * 0.55;
  runtime.controls.maxDistance = volumeScale * 4;
  runtime.controls.update();
}

function setPaused(runtime: DemoRuntime, paused: boolean): void {
  runtime.paused = paused;
  runtime.elements.pauseButton.textContent = paused ? 'Weiter' : 'Pausieren';
}

function updatePointOutput(runtime: DemoRuntime): void {
  runtime.elements.pointValue.value = String(Number(runtime.elements.pointSlider.value));
}

function updateStats(runtime: DemoRuntime): void {
  runtime.elements.fpsValue.textContent = formatNumber(runtime.metrics.averageFramesPerSecond);
  runtime.elements.p95Value.textContent = `${formatNumber(runtime.metrics.p95Milliseconds)} ms`;
  runtime.elements.connectionValue.textContent = formatInteger(runtime.network.stableConnectionCount);
  runtime.elements.tendrilValue.textContent = formatInteger(runtime.view.stats.tendrilCount);
  runtime.elements.triangleValue.textContent = formatInteger(runtime.view.stats.triangleCount);
  runtime.elements.generationValue.textContent = `${formatNumber(runtime.generationMilliseconds)} ms`;
}

function resizeRuntime(runtime: DemoRuntime): void {
  const pixelRatio = Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO);
  runtime.camera.aspect = window.innerWidth / window.innerHeight;
  runtime.camera.updateProjectionMatrix();
  runtime.renderer.setPixelRatio(pixelRatio);
  runtime.renderer.setSize(window.innerWidth, window.innerHeight, false);
  runtime.view.setPixelRatio(pixelRatio);
}

function disposeRuntime(runtime: DemoRuntime, handlers: DemoHandlers): void {
  runtime.renderer.setAnimationLoop(null);
  removeEventListeners(runtime.elements, handlers);
  runtime.timer.dispose();
  runtime.controls.dispose();
  runtime.view.dispose(runtime.scene);
  runtime.renderer.dispose();
  runtime.vrButton.remove();
}

function removeEventListeners(elements: DemoElements, handlers: DemoHandlers): void {
  elements.restartButton.removeEventListener('click', handlers.restart);
  elements.pauseButton.removeEventListener('click', handlers.togglePause);
  elements.pointSlider.removeEventListener('input', handlers.previewPointCount);
  elements.pointSlider.removeEventListener('change', handlers.rebuildPointCount);
  elements.volumeSlider.removeEventListener('input', handlers.updateVolume);
  window.removeEventListener('resize', handlers.resize);
}

function createScene(): Scene {
  const scene = new Scene();
  scene.background = new Color('#08090b');
  return scene;
}

function createCamera(): PerspectiveCamera {
  const camera = new PerspectiveCamera(
    CAMERA_FIELD_OF_VIEW,
    window.innerWidth / window.innerHeight,
    CAMERA_NEAR,
    CAMERA_FAR,
  );
  camera.position.set(9.5, 6.8, 9.5);
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

function getDemoElements(): DemoElements {
  return {
    canvas: requireElement('#scene'),
    volumeSlider: requireElement('#volume-slider'),
    volumeValue: requireElement('#volume-value'),
    pointSlider: requireElement('#point-slider'),
    pointValue: requireElement('#point-value'),
    restartButton: requireElement('#restart-button'),
    pauseButton: requireElement('#pause-button'),
    fpsValue: requireElement('#fps-value'),
    p95Value: requireElement('#p95-value'),
    connectionValue: requireElement('#connection-value'),
    tendrilValue: requireElement('#tendril-value'),
    triangleValue: requireElement('#triangle-value'),
    generationValue: requireElement('#generation-value'),
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

const pointSlider = document.querySelector<HTMLInputElement>('#point-slider');
if (pointSlider) {
  pointSlider.min = String(MIN_POINT_COUNT);
  pointSlider.max = String(MAX_POINT_COUNT);
}

const dispose = start();
window.addEventListener('pagehide', dispose, { once: true });
