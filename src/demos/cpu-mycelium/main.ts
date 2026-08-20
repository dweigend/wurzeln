/**
 * Browser bootstrap and lifecycle coordinator for the mycelium mini demo.
 * It owns the Three.js scene, controls, fixed-step simulation loop, UI wiring,
 * resize handling, and disposal. Domain growth and rendering stay separate.
 */

import './styles.css';

import {
  ACESFilmicToneMapping,
  AmbientLight,
  Color,
  DirectionalLight,
  FogExp2,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Timer,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MyceliumSimulation } from '../../lib/mycelium-simulation.ts';
import { MyceliumView } from './mycelium-view.ts';

const INITIAL_SEED = 20_260_819;
const MAX_PIXEL_RATIO = 2;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 60;
const CAMERA_FIELD_OF_VIEW = 46;
const STATS_REFRESH_SECONDS = 0.15;

type DemoElements = {
  canvas: HTMLCanvasElement;
  restartButton: HTMLButtonElement;
  pauseButton: HTMLButtonElement;
  tipCount: HTMLElement;
  edgeCount: HTMLElement;
  fusionCount: HTMLElement;
  seedValue: HTMLElement;
};

type DemoRuntime = {
  elements: DemoElements;
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  controls: OrbitControls;
  simulation: MyceliumSimulation;
  view: MyceliumView;
  timer: Timer;
  seed: number;
  paused: boolean;
  statsElapsedSeconds: number;
};

function start(): () => void {
  const runtime = createRuntime();
  const restart = (): void => restartSimulation(runtime);
  const togglePause = (): void => setPaused(runtime, !runtime.paused);
  const resize = (): void => resizeRuntime(runtime);
  const animate = (timeMilliseconds: number): void => renderFrame(runtime, timeMilliseconds);

  runtime.elements.restartButton.addEventListener('click', restart);
  runtime.elements.pauseButton.addEventListener('click', togglePause);
  window.addEventListener('resize', resize);
  resizeRuntime(runtime);
  updateStats(runtime);
  runtime.renderer.setAnimationLoop(animate);

  return (): void => disposeRuntime(runtime, { restart, togglePause, resize });
}

function createRuntime(): DemoRuntime {
  const elements = getDemoElements();
  const scene = createScene();
  const camera = createCamera();
  const renderer = createRenderer(elements.canvas);
  const controls = createControls(camera, elements.canvas);
  const simulation = new MyceliumSimulation({ seed: INITIAL_SEED });
  const timer = new Timer();
  timer.connect(document);

  return {
    elements,
    scene,
    camera,
    renderer,
    controls,
    simulation,
    view: new MyceliumView(scene, {
      maxEdges: simulation.config.maxEdges,
      maxTips: simulation.config.maxActiveTips,
    }),
    timer,
    seed: INITIAL_SEED,
    paused: false,
    statsElapsedSeconds: STATS_REFRESH_SECONDS,
  };
}

function renderFrame(runtime: DemoRuntime, timeMilliseconds: number): void {
  runtime.timer.update(timeMilliseconds);
  const deltaSeconds = runtime.timer.getDelta();
  if (!runtime.paused) runtime.simulation.update(deltaSeconds);
  runtime.view.update(runtime.simulation);
  runtime.controls.update();
  runtime.renderer.render(runtime.scene, runtime.camera);
  runtime.statsElapsedSeconds += deltaSeconds;
  if (runtime.statsElapsedSeconds < STATS_REFRESH_SECONDS) return;
  runtime.statsElapsedSeconds = 0;
  updateStats(runtime);
}

function restartSimulation(runtime: DemoRuntime): void {
  runtime.seed += 1;
  runtime.simulation.reset(runtime.seed);
  runtime.view.reset();
  updateStats(runtime);
}

function setPaused(runtime: DemoRuntime, paused: boolean): void {
  runtime.paused = paused;
  runtime.elements.pauseButton.textContent = paused ? 'Weiter' : 'Pausieren';
}

function updateStats(runtime: DemoRuntime): void {
  runtime.elements.tipCount.textContent = String(runtime.simulation.activeTipCount);
  runtime.elements.edgeCount.textContent = String(runtime.simulation.edges.length);
  runtime.elements.fusionCount.textContent = String(runtime.simulation.fusionCount);
  runtime.elements.seedValue.textContent = String(runtime.seed);
}

function resizeRuntime(runtime: DemoRuntime): void {
  runtime.camera.aspect = window.innerWidth / window.innerHeight;
  runtime.camera.updateProjectionMatrix();
  runtime.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  runtime.renderer.setSize(window.innerWidth, window.innerHeight, false);
}

function disposeRuntime(
  runtime: DemoRuntime,
  handlers: { restart: () => void; togglePause: () => void; resize: () => void },
): void {
  runtime.renderer.setAnimationLoop(null);
  runtime.elements.restartButton.removeEventListener('click', handlers.restart);
  runtime.elements.pauseButton.removeEventListener('click', handlers.togglePause);
  window.removeEventListener('resize', handlers.resize);
  runtime.timer.dispose();
  runtime.controls.dispose();
  runtime.view.dispose();
  runtime.renderer.dispose();
}

function getDemoElements(): DemoElements {
  return {
    canvas: requireElement('#scene'),
    restartButton: requireElement('#restart-button'),
    pauseButton: requireElement('#pause-button'),
    tipCount: requireElement('#tip-count'),
    edgeCount: requireElement('#edge-count'),
    fusionCount: requireElement('#fusion-count'),
    seedValue: requireElement('#seed-value'),
  };
}

function requireElement<ElementType extends Element>(selector: string): ElementType {
  const element = document.querySelector<ElementType>(selector);
  if (!element) throw new Error(`Required element not found: ${selector}`);
  return element;
}

function createScene(): Scene {
  const scene = new Scene();
  scene.background = new Color('#07110f');
  scene.fog = new FogExp2('#07110f', 0.055);
  scene.add(new AmbientLight('#8ab7a9', 1.5));

  const keyLight = new DirectionalLight('#d9ffec', 3.2);
  keyLight.position.set(4, 6, 3);
  scene.add(keyLight);

  const rimLight = new DirectionalLight('#d88a4c', 2.1);
  rimLight.position.set(-5, -2, -4);
  scene.add(rimLight);
  return scene;
}

function createCamera(): PerspectiveCamera {
  const camera = new PerspectiveCamera(
    CAMERA_FIELD_OF_VIEW,
    window.innerWidth / window.innerHeight,
    CAMERA_NEAR,
    CAMERA_FAR,
  );
  camera.position.set(7.5, 5.4, 7.5);
  return camera;
}

function createRenderer(canvas: HTMLCanvasElement): WebGLRenderer {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  return renderer;
}

function createControls(
  camera: PerspectiveCamera,
  canvas: HTMLCanvasElement,
): OrbitControls {
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 3.5;
  controls.maxDistance = 18;
  controls.target.set(0, 0, 0);
  controls.update();
  return controls;
}

const dispose = start();
window.addEventListener('pagehide', dispose, { once: true });
