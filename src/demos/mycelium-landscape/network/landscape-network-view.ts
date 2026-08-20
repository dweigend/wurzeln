/**
 * Renders the underground graph as one instanced low-poly tube surface.
 * A shared height texture keeps procedural curves beneath the terrain.
 */

import {
  ClampToEdgeWrapping,
  DataTexture,
  FloatType,
  GLSL3,
  InstancedBufferGeometry,
  LinearFilter,
  Mesh,
  RedFormat,
  Scene,
  ShaderMaterial,
} from 'three';
import { createNetworkGeometry } from '../../../lib/network-geometry.ts';
import type { GeneratedNetwork } from '../../../lib/settings.ts';
import type { HeightField } from '../terrain/height-field.ts';
import myceliumFragmentShader from './shaders/mycelium.frag.glsl?raw';
import myceliumVertexShader from './shaders/mycelium.vert.glsl?raw';

export class LandscapeNetworkView {
  readonly hyphaCount: number;

  private readonly heightTexture: DataTexture;
  private readonly material: ShaderMaterial;
  private readonly mesh: Mesh<InstancedBufferGeometry, ShaderMaterial>;

  constructor(scene: Scene, field: Readonly<HeightField>, network: Readonly<GeneratedNetwork>) {
    this.heightTexture = createHeightTexture(field);
    this.material = createMyceliumMaterial(field, this.heightTexture);
    const geometry = createNetworkGeometry(network);
    this.mesh = new Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.hyphaCount = network.hyphaCount;
    scene.add(this.mesh);
  }

  setVisible(visible: boolean): void {
    this.mesh.visible = visible;
  }

  setGrowthTime(elapsedSeconds: number): void {
    this.material.uniforms['uTimeSeconds']!.value = elapsedSeconds;
  }

  dispose(): void {
    this.mesh.removeFromParent();
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
      uTimeSeconds: { value: 20 },
      uTerrainSizeMeters: { value: field.sizeMeters },
      uHeightMap: { value: heightTexture },
    },
  });
}
