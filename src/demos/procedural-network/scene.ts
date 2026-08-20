/**
 * Creates and owns the WebXR-capable procedural-network scene.
 * Network data and drawables stay outside; this adapter owns viewport state,
 * camera framing, renderer, controls, VR button, and disposal.
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

const MAXIMUM_PIXEL_RATIO = 1.5;
const CAMERA_FIELD_OF_VIEW = 48;
const CAMERA_NEAR = 0.05;
const CAMERA_FAR = 180;

export type ProceduralNetworkScene = Readonly<{
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  controls: OrbitControls;
  fitToVolume: (sizeMeters: number) => void;
  resize: () => number;
  dispose: () => void;
}>;

export function createScene(canvas: HTMLCanvasElement): ProceduralNetworkScene {
  const scene = new Scene();
  scene.background = new Color('#08090b');
  const camera = new PerspectiveCamera(
    CAMERA_FIELD_OF_VIEW,
    window.innerWidth / window.innerHeight,
    CAMERA_NEAR,
    CAMERA_FAR,
  );
  camera.position.set(9.5, 6.8, 9.5);
  const renderer = createRenderer(canvas);
  const controls = createOrbitControls(camera, canvas);
  const vrButton = VRButton.createButton(renderer);
  document.body.appendChild(vrButton);

  return {
    scene,
    camera,
    renderer,
    controls,
    fitToVolume: (sizeMeters): void => fitToVolume(camera, controls, sizeMeters),
    resize: (): number => resizeViewport(camera, renderer, MAXIMUM_PIXEL_RATIO),
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
  return renderer;
}

function fitToVolume(
  camera: PerspectiveCamera,
  controls: OrbitControls,
  sizeMeters: number,
): void {
  const direction = camera.position.clone().sub(controls.target);
  if (direction.lengthSq() === 0) direction.copy(new Vector3(1, 0.72, 1));
  direction.normalize();
  camera.position.copy(controls.target).addScaledVector(direction, sizeMeters * 1.65);
  controls.minDistance = sizeMeters * 0.55;
  controls.maxDistance = sizeMeters * 4;
  controls.update();
}
