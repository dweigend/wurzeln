/**
 * Creates and owns the desktop scene used by the CPU mycelium demo.
 * Simulation and view resources stay outside; this adapter owns environment,
 * camera, renderer, controls, viewport sizing, and their disposal.
 */

import {
  ACESFilmicToneMapping,
  AmbientLight,
  Color,
  DirectionalLight,
  FogExp2,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createOrbitControls, resizeViewport } from '../../lib/scene.ts';

const MAXIMUM_PIXEL_RATIO = 2;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 60;
const CAMERA_FIELD_OF_VIEW = 46;

export type CpuMyceliumScene = Readonly<{
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  controls: OrbitControls;
  resize: () => void;
  dispose: () => void;
}>;

export function createScene(canvas: HTMLCanvasElement): CpuMyceliumScene {
  const scene = createEnvironment();
  const camera = new PerspectiveCamera(
    CAMERA_FIELD_OF_VIEW,
    window.innerWidth / window.innerHeight,
    CAMERA_NEAR,
    CAMERA_FAR,
  );
  camera.position.set(7.5, 5.4, 7.5);
  const renderer = createRenderer(canvas);
  const controls = createOrbitControls(camera, canvas);
  controls.minDistance = 3.5;
  controls.maxDistance = 18;
  controls.update();

  return {
    scene,
    camera,
    renderer,
    controls,
    resize: (): void => { resizeViewport(camera, renderer, MAXIMUM_PIXEL_RATIO); },
    dispose: (): void => {
      controls.dispose();
      renderer.dispose();
    },
  };
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

function createEnvironment(): Scene {
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
