/**
 * WebGL2 instanced view for the procedural network experiment.
 * It owns three drawables: shader-deformed tendrils, point nodes, and a box
 * boundary. Runtime animation changes uniforms only; topology stays immutable.
 */

import {
  BufferGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  GLSL3,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LineSegments,
  Mesh,
  Points,
  Scene,
  ShaderMaterial,
} from 'three';
import type { GeneratedNetwork } from '../network/network-generator.ts';
import pointFragmentShader from './shaders/points.frag.glsl?raw';
import pointVertexShader from './shaders/points.vert.glsl?raw';
import tendrilFragmentShader from './shaders/tendril.frag.glsl?raw';
import tendrilVertexShader from './shaders/tendril.vert.glsl?raw';
import volumeFragmentShader from './shaders/volume.frag.glsl?raw';
import volumeVertexShader from './shaders/volume.vert.glsl?raw';

const RADIAL_SEGMENTS = 3;
const LONGITUDINAL_SEGMENTS = 12;
const TRIANGLES_PER_TENDRIL = RADIAL_SEGMENTS * LONGITUDINAL_SEGMENTS * 2;
const BACKGROUND_COLOR = new Color('#08090b');

export type ProceduralNetworkViewStats = {
  tendrilCount: number;
  triangleCount: number;
};

export class ProceduralNetworkView {
  readonly group = new Group();

  private readonly timeUniform = { value: 0 };
  private readonly volumeScaleUniform = { value: 8 };
  private readonly pixelRatioUniform = { value: 1 };
  private readonly tendrilMaterial = createTendrilMaterial(
    this.timeUniform,
    this.volumeScaleUniform,
  );
  private readonly pointMaterial = createPointMaterial(
    this.timeUniform,
    this.volumeScaleUniform,
    this.pixelRatioUniform,
  );
  private readonly volumeMaterial = createVolumeMaterial(this.volumeScaleUniform);
  private readonly volumeLines = createVolumeLines(this.volumeMaterial);
  private tendrilMesh: Mesh<InstancedBufferGeometry, ShaderMaterial> | undefined;
  private pointMesh: Points<BufferGeometry, ShaderMaterial> | undefined;
  private currentStats: ProceduralNetworkViewStats = { tendrilCount: 0, triangleCount: 0 };

  constructor(scene: Scene) {
    this.group.add(this.volumeLines);
    scene.add(this.group);
  }

  get stats(): Readonly<ProceduralNetworkViewStats> {
    return this.currentStats;
  }

  setNetwork(network: GeneratedNetwork): void {
    this.removeNetworkGeometry();
    this.tendrilMesh = createTendrilMesh(network, this.tendrilMaterial);
    this.pointMesh = createPointMesh(network.points, this.pointMaterial);
    this.group.add(this.tendrilMesh, this.pointMesh);
    this.currentStats = {
      tendrilCount: network.tendrilCount,
      triangleCount: network.tendrilCount * TRIANGLES_PER_TENDRIL,
    };
  }

  update(elapsedSeconds: number): void {
    this.timeUniform.value = elapsedSeconds;
  }

  setVolumeScale(scale: number): void {
    this.volumeScaleUniform.value = scale;
  }

  setPixelRatio(pixelRatio: number): void {
    this.pixelRatioUniform.value = pixelRatio;
  }

  dispose(scene: Scene): void {
    scene.remove(this.group);
    this.removeNetworkGeometry();
    this.volumeLines.geometry.dispose();
    this.tendrilMaterial.dispose();
    this.pointMaterial.dispose();
    this.volumeMaterial.dispose();
  }

  private removeNetworkGeometry(): void {
    if (this.tendrilMesh) {
      this.group.remove(this.tendrilMesh);
      this.tendrilMesh.geometry.dispose();
      this.tendrilMesh = undefined;
    }
    if (this.pointMesh) {
      this.group.remove(this.pointMesh);
      this.pointMesh.geometry.dispose();
      this.pointMesh = undefined;
    }
  }
}

function createTendrilMaterial(
  timeUniform: { value: number },
  volumeScaleUniform: { value: number },
): ShaderMaterial {
  return new ShaderMaterial({
    glslVersion: GLSL3,
    vertexShader: tendrilVertexShader,
    fragmentShader: tendrilFragmentShader,
    uniforms: {
      uTime: timeUniform,
      uVolumeScale: volumeScaleUniform,
      uFogColor: { value: BACKGROUND_COLOR },
      uFogDensity: { value: 0.035 },
    },
  });
}

function createPointMaterial(
  timeUniform: { value: number },
  volumeScaleUniform: { value: number },
  pixelRatioUniform: { value: number },
): ShaderMaterial {
  return new ShaderMaterial({
    glslVersion: GLSL3,
    vertexShader: pointVertexShader,
    fragmentShader: pointFragmentShader,
    uniforms: {
      uTime: timeUniform,
      uVolumeScale: volumeScaleUniform,
      uPixelRatio: pixelRatioUniform,
    },
  });
}

function createVolumeMaterial(volumeScaleUniform: { value: number }): ShaderMaterial {
  return new ShaderMaterial({
    glslVersion: GLSL3,
    vertexShader: volumeVertexShader,
    fragmentShader: volumeFragmentShader,
    uniforms: { uVolumeScale: volumeScaleUniform },
  });
}

function createTendrilMesh(
  network: GeneratedNetwork,
  material: ShaderMaterial,
): Mesh<InstancedBufferGeometry, ShaderMaterial> {
  const geometry = createTendrilGeometry(network);
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  return mesh;
}

function createTendrilGeometry(network: GeneratedNetwork): InstancedBufferGeometry {
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
  geometry.setAttribute('aKind', new InstancedBufferAttribute(network.kinds, 1));
  geometry.instanceCount = network.tendrilCount;
  return geometry;
}

function createPointMesh(
  positions: Float32Array,
  material: ShaderMaterial,
): Points<BufferGeometry, ShaderMaterial> {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  return points;
}

function createVolumeLines(material: ShaderMaterial): LineSegments<BufferGeometry, ShaderMaterial> {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(createBoxLinePositions(), 3));
  const lines = new LineSegments(geometry, material);
  lines.frustumCulled = false;
  return lines;
}

function createBoxLinePositions(): number[] {
  const corners = [
    [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5],
    [-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5],
  ] as const;
  const edgeIndices = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7];
  return edgeIndices.flatMap((index) => [...(corners[index] ?? [0, 0, 0])]);
}
