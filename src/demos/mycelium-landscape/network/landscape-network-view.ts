/**
 * Renders the underground graph as one instanced low-poly tube surface.
 * A shared height texture keeps procedural curves beneath the terrain.
 */

import {
  ClampToEdgeWrapping,
  CylinderGeometry,
  DataTexture,
  FloatType,
  GLSL3,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LinearFilter,
  Mesh,
  RedFormat,
  Scene,
  ShaderMaterial,
} from 'three';
import type { GeneratedNetwork } from '../../procedural-network/network/network-generator.ts';
import type { HeightField } from '../terrain/height-field.ts';
import myceliumFragmentShader from './shaders/mycelium.frag.glsl?raw';
import myceliumVertexShader from './shaders/mycelium.vert.glsl?raw';

const RADIAL_SEGMENTS = 3;
const LONGITUDINAL_SEGMENTS = 16;
const TRIANGLES_PER_HYPHA = RADIAL_SEGMENTS * LONGITUDINAL_SEGMENTS * 2;

export class LandscapeNetworkView {
  readonly triangleCount: number;
  readonly hyphaCount: number;

  private readonly heightTexture: DataTexture;
  private readonly material: ShaderMaterial;
  private readonly mesh: Mesh<InstancedBufferGeometry, ShaderMaterial>;

  constructor(scene: Scene, field: Readonly<HeightField>, network: Readonly<GeneratedNetwork>) {
    this.heightTexture = createHeightTexture(field);
    this.material = createMyceliumMaterial(field, this.heightTexture);
    const geometry = createMyceliumGeometry(network);
    this.mesh = new Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.hyphaCount = network.hyphaCount;
    this.triangleCount = network.hyphaCount * TRIANGLES_PER_HYPHA;
    scene.add(this.mesh);
  }

  setVisible(visible: boolean): void {
    this.mesh.visible = visible;
  }

  setGrowthTime(seconds: number): void {
    this.material.uniforms['uTime']!.value = seconds;
  }

  dispose(scene: Scene): void {
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.heightTexture.dispose();
  }
}

function createHeightTexture(field: Readonly<HeightField>): DataTexture {
  const texture = new DataTexture(
    field.heights,
    field.resolution,
    field.resolution,
    RedFormat,
    FloatType,
  );
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function createMyceliumMaterial(
  field: Readonly<HeightField>,
  heightTexture: DataTexture,
): ShaderMaterial {
  return new ShaderMaterial({
    glslVersion: GLSL3,
    vertexShader: myceliumVertexShader,
    fragmentShader: myceliumFragmentShader,
    uniforms: {
      uTime: { value: 20 },
      uTerrainSize: { value: field.size },
      uHeightMap: { value: heightTexture },
    },
  });
}

function createMyceliumGeometry(network: Readonly<GeneratedNetwork>): InstancedBufferGeometry {
  const base = new CylinderGeometry(1, 1, 1, RADIAL_SEGMENTS, LONGITUDINAL_SEGMENTS, true);
  const geometry = new InstancedBufferGeometry();
  geometry.setIndex(base.getIndex());
  geometry.setAttribute('position', base.getAttribute('position'));
  geometry.setAttribute('aStart', new InstancedBufferAttribute(network.starts, 3));
  geometry.setAttribute('aEnd', new InstancedBufferAttribute(network.ends, 3));
  geometry.setAttribute('aSeed', new InstancedBufferAttribute(network.seeds, 1));
  geometry.setAttribute('aStartTime', new InstancedBufferAttribute(network.startTimes, 1));
  geometry.setAttribute('aDuration', new InstancedBufferAttribute(network.durations, 1));
  geometry.setAttribute('aRadius', new InstancedBufferAttribute(network.radii, 1));
  geometry.setAttribute('aReinforcement', new InstancedBufferAttribute(network.reinforcements, 1));
  geometry.instanceCount = network.hyphaCount;
  base.dispose();
  return geometry;
}
