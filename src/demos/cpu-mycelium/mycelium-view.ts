/**
 * GPU-instanced Three.js view for a MyceliumSimulation.
 * One InstancedMesh renders all cylindrical graph edges and another renders
 * active tips, keeping draw calls bounded while the CPU graph grows.
 */

import {
  Color,
  CylinderGeometry,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  Scene,
  SphereGeometry,
  Vector3,
} from 'three';
import type { MyceliumSimulation, NetworkEdge } from '../../lib/mycelium-simulation.ts';

type MyceliumViewConfig = {
  maxEdges: number;
  maxTips: number;
  radialSegments: number;
  growthDurationSeconds: number;
  fusionDurationSeconds: number;
};

const DEFAULT_VIEW_CONFIG: Readonly<MyceliumViewConfig> = Object.freeze({
  maxEdges: 5_000,
  maxTips: 84,
  radialSegments: 6,
  growthDurationSeconds: 0.16,
  fusionDurationSeconds: 0.42,
});

const UP_AXIS = new Vector3(0, 1, 0);
const GROWTH_COLOR = new Color('#54bfa6');
const FUSION_COLOR = new Color('#f3b66f');
const TIP_COLOR = new Color('#dfffee');

export class MyceliumView {
  readonly group = new Group();

  private readonly edgeMesh: InstancedMesh;
  private readonly tipMesh: InstancedMesh;
  private readonly edgeTransform = new Object3D();
  private readonly tipTransform = new Object3D();
  private readonly direction = new Vector3();
  private readonly visibleEnd = new Vector3();
  private readonly midpoint = new Vector3();
  private readonly animatingEdges = new Set<number>();
  private readonly config: Readonly<MyceliumViewConfig>;
  private syncedEdgeCount = 0;

  constructor(scene: Scene, config: Partial<MyceliumViewConfig> = {}) {
    this.config = Object.freeze({ ...DEFAULT_VIEW_CONFIG, ...config });
    this.edgeMesh = createEdgeMesh(this.config);
    this.tipMesh = createTipMesh(this.config.maxTips);
    this.group.add(this.edgeMesh, this.tipMesh);
    scene.add(this.group);
  }

  update(simulation: MyceliumSimulation): void {
    if (simulation.edges.length < this.syncedEdgeCount) this.reset();
    this.syncNewEdges(simulation);
    this.animateEdges(simulation);
    this.syncTips(simulation);
  }

  reset(): void {
    this.syncedEdgeCount = 0;
    this.animatingEdges.clear();
    this.edgeMesh.count = 0;
    this.tipMesh.count = 0;
  }

  dispose(): void {
    this.group.removeFromParent();
    this.edgeMesh.geometry.dispose();
    this.tipMesh.geometry.dispose();
    disposeMaterial(this.edgeMesh.material);
    disposeMaterial(this.tipMesh.material);
  }

  private syncNewEdges(simulation: MyceliumSimulation): void {
    while (this.syncedEdgeCount < simulation.edges.length) {
      const edge = simulation.edges[this.syncedEdgeCount];
      if (!edge) break;
      this.edgeMesh.setColorAt(
        this.syncedEdgeCount,
        edge.kind === 'fusion' ? FUSION_COLOR : GROWTH_COLOR,
      );
      this.animatingEdges.add(this.syncedEdgeCount);
      this.syncedEdgeCount += 1;
    }

    this.edgeMesh.count = this.syncedEdgeCount;
    if (this.edgeMesh.instanceColor) this.edgeMesh.instanceColor.needsUpdate = true;
  }

  private animateEdges(simulation: MyceliumSimulation): void {
    let changed = false;
    for (const index of [...this.animatingEdges]) {
      const edge = simulation.edges[index];
      if (!edge) continue;
      const completed = this.updateEdgeTransform(index, edge, simulation);
      changed = true;
      if (completed) this.animatingEdges.delete(index);
    }
    if (changed) this.edgeMesh.instanceMatrix.needsUpdate = true;
  }

  private getEdgeProgress(edge: NetworkEdge, currentTimeSeconds: number): number {
    const duration = edge.kind === 'fusion'
      ? this.config.fusionDurationSeconds
      : this.config.growthDurationSeconds;
    const linear = Math.min(1, (currentTimeSeconds - edge.createdAtSeconds) / duration);
    return linear * linear * (3 - 2 * linear);
  }

  private updateEdgeTransform(
    index: number,
    edge: NetworkEdge,
    simulation: MyceliumSimulation,
  ): boolean {
    const start = simulation.nodes[edge.from]?.position;
    const end = simulation.nodes[edge.to]?.position;
    if (!start || !end) return true;

    const progress = this.getEdgeProgress(edge, simulation.renderTimeSeconds);
    this.visibleEnd.lerpVectors(start, end, progress);
    this.direction.subVectors(this.visibleEnd, start);
    const length = Math.max(this.direction.length(), Number.EPSILON);
    this.midpoint.addVectors(start, this.visibleEnd).multiplyScalar(0.5);
    this.edgeTransform.position.copy(this.midpoint);
    this.edgeTransform.quaternion.setFromUnitVectors(UP_AXIS, this.direction.normalize());
    this.edgeTransform.scale.set(edge.radius, length, edge.radius);
    this.edgeTransform.updateMatrix();
    this.edgeMesh.setMatrixAt(index, this.edgeTransform.matrix);
    return progress === 1;
  }

  private syncTips(simulation: MyceliumSimulation): void {
    let renderedTipCount = 0;
    for (const tip of simulation.tips) {
      const position = simulation.nodes[tip.nodeId]?.position;
      if (!position || renderedTipCount >= this.config.maxTips) continue;
      const scale = Math.max(0.7, tip.radius / simulation.config.initialRadius);
      this.tipTransform.position.copy(position);
      this.tipTransform.scale.setScalar(scale);
      this.tipTransform.updateMatrix();
      this.tipMesh.setMatrixAt(renderedTipCount, this.tipTransform.matrix);
      renderedTipCount += 1;
    }
    this.tipMesh.count = renderedTipCount;
    this.tipMesh.instanceMatrix.needsUpdate = true;
  }
}

function createEdgeMesh(config: Readonly<MyceliumViewConfig>): InstancedMesh {
  const geometry = new CylinderGeometry(1, 1, 1, config.radialSegments, 1, true);
  const material = new MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.58,
    metalness: 0.04,
  });
  const mesh = new InstancedMesh(geometry, material, config.maxEdges);
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  return mesh;
}

function createTipMesh(maxTips: number): InstancedMesh {
  const geometry = new SphereGeometry(0.07, 8, 6);
  const material = new MeshStandardMaterial({
    color: TIP_COLOR,
    emissive: TIP_COLOR,
    emissiveIntensity: 0.7,
    roughness: 0.35,
  });
  const mesh = new InstancedMesh(geometry, material, maxTips);
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  return mesh;
}

function disposeMaterial(material: InstancedMesh['material']): void {
  if (Array.isArray(material)) {
    for (const entry of material) entry.dispose();
    return;
  }
  material.dispose();
}
