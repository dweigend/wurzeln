/**
 * Shared low-level viewport helpers for the concrete demo scene adapters.
 * Renderer configuration, camera framing, lighting, WebXR, and disposal remain
 * owned by each demo because those policies intentionally differ.
 */

import type { PerspectiveCamera, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createOrbitControls(
  camera: PerspectiveCamera,
  canvas: HTMLCanvasElement,
): OrbitControls {
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.target.set(0, 0, 0);
  controls.update();
  return controls;
}

export function resizeViewport(
  camera: PerspectiveCamera,
  renderer: WebGLRenderer,
  maximumPixelRatio: number,
): number {
  const pixelRatio = Math.min(window.devicePixelRatio, maximumPixelRatio);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  return pixelRatio;
}
