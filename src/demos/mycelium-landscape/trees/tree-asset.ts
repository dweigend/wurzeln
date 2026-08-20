/**
 * Loads the local CC0 birch pack and exposes only its lightest tree variant.
 * Asset loading stays separate from placement and instanced rendering.
 */

import { Mesh, MeshStandardMaterial, Texture, type BufferGeometry } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const ASSET_URL = '/assets/birch-trees/birch-trees.glb';
const VARIANT_NAME = 'BirchTree_4';

export type TreePart = {
  geometry: BufferGeometry;
  texture: Texture;
  alphaCutoff: number;
  tint: readonly [number, number, number];
};

export type TreeAsset = {
  parts: TreePart[];
  dispose: () => void;
};

export async function loadTreeAsset(): Promise<TreeAsset> {
  const gltf = await new GLTFLoader().loadAsync(ASSET_URL);
  const variant = gltf.scene.getObjectByName(VARIANT_NAME);
  if (!variant) throw new Error(`Tree variant not found: ${VARIANT_NAME}`);
  const parts: TreePart[] = [];

  variant.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const material = requireStandardMaterial(object.material);
    if (!material.map) throw new Error(`Tree material has no color texture: ${material.name}`);
    const leaves = material.name.includes('Leaves');
    parts.push({
      geometry: object.geometry,
      texture: material.map,
      alphaCutoff: leaves ? 0.42 : 0,
      tint: leaves ? [0.62, 0.16, 0.33] : [0.86, 0.76, 0.7],
    });
  });

  if (parts.length === 0) throw new Error(`Tree variant contains no meshes: ${VARIANT_NAME}`);
  return { parts, dispose: (): void => disposeTreeAsset(parts) };
}

function requireStandardMaterial(material: Mesh['material']): MeshStandardMaterial {
  if (Array.isArray(material) || !(material instanceof MeshStandardMaterial)) {
    throw new Error('Expected one standard tree material per primitive');
  }
  return material;
}

function disposeTreeAsset(parts: readonly TreePart[]): void {
  const textures = new Set(parts.map((part) => part.texture));
  const geometries = new Set(parts.map((part) => part.geometry));
  for (const texture of textures) texture.dispose();
  for (const geometry of geometries) geometry.dispose();
}
