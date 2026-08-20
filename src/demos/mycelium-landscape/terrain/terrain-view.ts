/**
 * Owns the procedural terrain surface and its phase-driven WebGL2 material.
 * Geometry is immutable after generation; animation changes uniforms only.
 */

import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  GLSL3,
  Mesh,
  Scene,
  ShaderMaterial,
  Uint32BufferAttribute,
} from 'three';
import type { HeightField } from './height-field.ts';
import terrainFragmentShader from './shaders/terrain.frag.glsl?raw';
import terrainVertexShader from './shaders/terrain.vert.glsl?raw';

export class TerrainView {
  readonly triangleCount: number;

  private readonly material: ShaderMaterial;
  private readonly mesh: Mesh<BufferGeometry, ShaderMaterial>;

  constructor(scene: Scene, field: Readonly<HeightField>) {
    const geometry = createTerrainGeometry(field);
    this.material = createTerrainMaterial(field);
    this.mesh = new Mesh(geometry, this.material);
    this.triangleCount = geometry.getIndex()?.count ? (geometry.getIndex()?.count ?? 0) / 3 : 0;
    scene.add(this.mesh);
  }

  setTerrainReveal(value: number): void {
    this.material.uniforms['uTerrainReveal']!.value = value;
  }

  setSubsurfaceReveal(value: number): void {
    this.material.uniforms['uSubsurfaceReveal']!.value = value;
  }

  dispose(scene: Scene): void {
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

function createTerrainGeometry(field: Readonly<HeightField>): BufferGeometry {
  const positions = new Float32Array(field.resolution * field.resolution * 3);
  const uvs = new Float32Array(field.resolution * field.resolution * 2);
  writeTerrainVertices(field, positions, uvs);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(new Uint32BufferAttribute(createTerrainIndices(field.resolution), 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function writeTerrainVertices(
  field: Readonly<HeightField>,
  positions: Float32Array,
  uvs: Float32Array,
): void {
  for (let z = 0; z < field.resolution; z += 1) {
    for (let x = 0; x < field.resolution; x += 1) {
      const vertex = z * field.resolution + x;
      const u = x / (field.resolution - 1);
      const v = z / (field.resolution - 1);
      positions.set(
        [(u - 0.5) * field.size, field.heights[vertex] ?? 0, (v - 0.5) * field.size],
        vertex * 3,
      );
      uvs.set([u, v], vertex * 2);
    }
  }
}

function createTerrainIndices(resolution: number): Uint32Array {
  const indices = new Uint32Array((resolution - 1) * (resolution - 1) * 6);
  let offset = 0;
  for (let z = 0; z < resolution - 1; z += 1) {
    for (let x = 0; x < resolution - 1; x += 1) {
      const topLeft = z * resolution + x;
      const bottomLeft = topLeft + resolution;
      indices.set(
        [topLeft, bottomLeft, topLeft + 1, topLeft + 1, bottomLeft, bottomLeft + 1],
        offset,
      );
      offset += 6;
    }
  }
  return indices;
}

function createTerrainMaterial(field: Readonly<HeightField>): ShaderMaterial {
  return new ShaderMaterial({
    glslVersion: GLSL3,
    vertexShader: terrainVertexShader,
    fragmentShader: terrainFragmentShader,
    side: DoubleSide,
    uniforms: {
      uTerrainReveal: { value: 0 },
      uSubsurfaceReveal: { value: 0 },
      uMinimumHeight: { value: field.minimumHeight },
      uMaximumHeight: { value: field.maximumHeight },
    },
  });
}
