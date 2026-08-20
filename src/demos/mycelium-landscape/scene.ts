/**
 * Creates and owns the WebXR-capable landscape scene and camera framing.
 * Terrain, trees, and mycelium remain concrete external adapters; this module
 * owns renderer, controls, VR button, viewport sizing, and disposal.
 */

import {
  Color,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { createOrbitControls, resizeViewport } from '../../lib/scene.ts';

const MAXIMUM_PIXEL_RATIO = 1.35;
const CAMERA_FIELD_OF_VIEW = 48;
const CAMERA_NEAR = 0.05;
const CAMERA_FAR = 180;

export type LandscapeScene = Readonly<{
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  controls: OrbitControls;
  fitToLandscape: (sizeMeters: number) => void;
  resize: () => void;
  dispose: () => void;
}>;

export function createScene(canvas: HTMLCanvasElement): LandscapeScene {
  const scene = new Scene();
  scene.background = new Color('#0e0913');
  const camera = new PerspectiveCamera(
    CAMERA_FIELD_OF_VIEW,
    window.innerWidth / window.innerHeight,
    CAMERA_NEAR,
    CAMERA_FAR,
  );
  camera.position.set(22, 16, 22);
  const renderer = createRenderer(canvas);
  const controls = createOrbitControls(camera, canvas);
  const vrButton = VRButton.createButton(renderer);
  document.body.appendChild(vrButton);

  return {
    scene,
    camera,
    renderer,
    controls,
    fitToLandscape: (sizeMeters): void => fitToLandscape(camera, controls, sizeMeters),
    resize: (): void => { resizeViewport(camera, renderer, MAXIMUM_PIXEL_RATIO); },
    dispose: (): void => {
      vrButton.remove();
      controls.dispose();
      renderer.dispose();
    },
  };
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

function fitToLandscape(
  camera: PerspectiveCamera,
  controls: OrbitControls,
  sizeMeters: number,
): void {
  const direction = new Vector3(1, 0.72, 1).normalize();
  camera.position.copy(direction.multiplyScalar(sizeMeters * 1.15));
  controls.minDistance = sizeMeters * 0.35;
  controls.maxDistance = sizeMeters * 3;
  controls.update();
}
