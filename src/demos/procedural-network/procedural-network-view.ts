/**
 * WebGL2 instanced view for the procedural network experiment.
 * It owns three drawables: shader-deformed hyphae, point nodes, and a box
 * boundary. Runtime animation changes uniforms only; topology stays immutable.
 */

import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  GLSL3,
  Group,
  InstancedBufferGeometry,
  LineSegments,
  Mesh,
  Points,
  Scene,
  ShaderMaterial,
} from 'three';
import {
  createNetworkGeometry,
  TRIANGLES_PER_HYPHA,
} from '../../lib/network-geometry.ts';
import type { GeneratedNetwork } from '../../lib/settings.ts';
import pointFragmentShader from './shaders/points.frag.glsl?raw';
import pointVertexShader from './shaders/points.vert.glsl?raw';
import tendrilFragmentShader from './shaders/tendril.frag.glsl?raw';
import tendrilVertexShader from './shaders/tendril.vert.glsl?raw';
import volumeFragmentShader from './shaders/volume.frag.glsl?raw';
import volumeVertexShader from './shaders/volume.vert.glsl?raw';

const BACKGROUND_COLOR = new Color('#08090b');

type ProceduralNetworkViewStats = Readonly<{
  hyphaCount: number;
  triangleCount: number;
}>;

export class ProceduralNetworkView {
  readonly group = new Group();

  private readonly timeSecondsUniform = { value: 0 };
  private readonly volumeSizeMetersUniform = { value: 8 };
  private readonly pixelRatioUniform = { value: 1 };
  private readonly tendrilMaterial = createTendrilMaterial(
    this.timeSecondsUniform,
    this.volumeSizeMetersUniform,
  );
  private readonly pointMaterial = createPointMaterial(
    this.timeSecondsUniform,
    this.volumeSizeMetersUniform,
    this.pixelRatioUniform,
  );
  private readonly volumeMaterial = createVolumeMaterial(this.volumeSizeMetersUniform);
  private readonly volumeLines = createVolumeLines(this.volumeMaterial);
  private tendrilMesh: Mesh<InstancedBufferGeometry, ShaderMaterial> | undefined;
  private pointMesh: Points<BufferGeometry, ShaderMaterial> | undefined;
  private currentStats: ProceduralNetworkViewStats = { hyphaCount: 0, triangleCount: 0 };

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
      hyphaCount: network.hyphaCount,
      triangleCount: network.hyphaCount * TRIANGLES_PER_HYPHA,
    };
  }

  update(elapsedSeconds: number): void {
    this.timeSecondsUniform.value = elapsedSeconds;
  }

  setVolumeSizeMeters(sizeMeters: number): void {
    this.volumeSizeMetersUniform.value = sizeMeters;
  }

  setPixelRatio(pixelRatio: number): void {
    this.pixelRatioUniform.value = pixelRatio;
  }

  dispose(): void {
    this.group.removeFromParent();
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
  timeSecondsUniform: { value: number },
  volumeSizeMetersUniform: { value: number },
): ShaderMaterial {
  return new ShaderMaterial({
    glslVersion: GLSL3,
    vertexShader: tendrilVertexShader,
    fragmentShader: tendrilFragmentShader,
    uniforms: {
      uTimeSeconds: timeSecondsUniform,
      uVolumeSizeMeters: volumeSizeMetersUniform,
      uFogColor: { value: BACKGROUND_COLOR },
      uFogDensity: { value: 0.035 },
    },
  });
}

function createPointMaterial(
  timeSecondsUniform: { value: number },
  volumeSizeMetersUniform: { value: number },
  pixelRatioUniform: { value: number },
): ShaderMaterial {
  return new ShaderMaterial({
    glslVersion: GLSL3,
    vertexShader: pointVertexShader,
    fragmentShader: pointFragmentShader,
    uniforms: {
      uTimeSeconds: timeSecondsUniform,
      uVolumeSizeMeters: volumeSizeMetersUniform,
      uPixelRatio: pixelRatioUniform,
    },
  });
}

function createVolumeMaterial(volumeSizeMetersUniform: { value: number }): ShaderMaterial {
  return new ShaderMaterial({
    glslVersion: GLSL3,
    vertexShader: volumeVertexShader,
    fragmentShader: volumeFragmentShader,
    uniforms: { uVolumeSizeMeters: volumeSizeMetersUniform },
  });
}

function createTendrilMesh(
  network: GeneratedNetwork,
  material: ShaderMaterial,
): Mesh<InstancedBufferGeometry, ShaderMaterial> {
  const geometry = createNetworkGeometry(network);
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  return mesh;
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
