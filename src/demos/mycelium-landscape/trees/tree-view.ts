/**
 * Renders one birch variant as a small set of instanced WebGL2 draw calls.
 * Layer visibility is independent from immutable instance transformations.
 */

import {
  Color,
  GLSL3,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Scene,
  ShaderMaterial,
  Vector3,
} from 'three';
import type { TreeAsset, TreePart } from './tree-asset.ts';
import type { TreePlacement } from './tree-placement.ts';
import treeFragmentShader from './shaders/tree.frag.glsl?raw';
import treeVertexShader from './shaders/tree.vert.glsl?raw';

const MODEL_SCALE = 100;
const BASE_ROTATION = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);

export class TreeView {
  readonly triangleCount: number;
  readonly drawCallCount: number;

  private readonly meshes: InstancedMesh[];
  private readonly materials: ShaderMaterial[];

  constructor(scene: Scene, asset: Readonly<TreeAsset>, placements: readonly TreePlacement[]) {
    this.materials = asset.parts.map(createTreeMaterial);
    this.meshes = asset.parts.map((part, index) =>
      createTreeMesh(part, this.materials[index]!, placements),
    );
    this.triangleCount = asset.parts.reduce(
      (sum, part) => sum + ((part.geometry.getIndex()?.count ?? 0) / 3) * placements.length,
      0,
    );
    this.drawCallCount = this.meshes.length;
    scene.add(...this.meshes);
  }

  setVisible(visible: boolean): void {
    for (const mesh of this.meshes) mesh.visible = visible;
  }

  dispose(scene: Scene): void {
    scene.remove(...this.meshes);
    for (const mesh of this.meshes) mesh.geometry.dispose();
    for (const material of this.materials) material.dispose();
  }
}

function createTreeMesh(
  part: Readonly<TreePart>,
  material: ShaderMaterial,
  placements: readonly TreePlacement[],
): InstancedMesh {
  const geometry = part.geometry.clone();
  const mesh = new InstancedMesh(geometry, material, placements.length);
  placements.forEach((placement, index) => mesh.setMatrixAt(index, createTreeMatrix(placement)));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  return mesh;
}

function createTreeMatrix(placement: Readonly<TreePlacement>): Matrix4 {
  const yaw = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), placement.rotation);
  const rotation = yaw.multiply(BASE_ROTATION);
  const scale = MODEL_SCALE * placement.scale;
  return new Matrix4().compose(
    new Vector3(placement.x, placement.y, placement.z),
    rotation,
    new Vector3(scale, scale, scale),
  );
}

function createTreeMaterial(part: Readonly<TreePart>): ShaderMaterial {
  return new ShaderMaterial({
    glslVersion: GLSL3,
    vertexShader: treeVertexShader,
    fragmentShader: treeFragmentShader,
    uniforms: {
      uMap: { value: part.texture },
      uAlphaCutoff: { value: part.alphaCutoff },
      uTint: { value: new Color(...part.tint) },
    },
  });
}
