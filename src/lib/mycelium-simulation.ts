/**
 * Deterministic CPU simulation for a branching mycelium graph.
 * Growth tips append nodes and edges at a fixed rate; nearby compatible tips
 * fuse through a permanent junction. Rendering concerns stay outside this file.
 */

import { Vector3 } from 'three';
import { createRandom } from './random.ts';

type EdgeKind = 'growth' | 'fusion';

type NetworkNode = Readonly<{
  id: number;
  position: Vector3;
}>;

export type NetworkEdge = Readonly<{
  from: number;
  to: number;
  radius: number;
  kind: EdgeKind;
  createdAtSeconds: number;
}>;

type GrowthTip = {
  id: number;
  nodeId: number;
  lineageId: number;
  direction: Vector3;
  radius: number;
  ageSteps: number;
  active: boolean;
};

type MyceliumConfig = Readonly<{
  seed: number;
  colonyCount: number;
  updatesPerSecond: number;
  maxStepsPerFrame: number;
  maxFrameDeltaSeconds: number;
  maxEdges: number;
  maxActiveTips: number;
  maxTipAgeSteps: number;
  worldRadius: number;
  colonyRadius: number;
  stepLength: number;
  directionPersistence: number;
  randomSteering: number;
  boundarySteering: number;
  attractionSteering: number;
  attractionRadius: number;
  fusionRadius: number;
  fusionApproachThreshold: number;
  branchChancePerStep: number;
  minimumBranchAgeSteps: number;
  branchAngleRadians: number;
  initialRadius: number;
  minimumRadius: number;
  radiusDecayPerStep: number;
  branchRadiusRatio: number;
}>;

const DEFAULT_MYCELIUM_CONFIG: MyceliumConfig = Object.freeze({
  seed: 20_260_819,
  colonyCount: 12,
  updatesPerSecond: 15,
  maxStepsPerFrame: 4,
  maxFrameDeltaSeconds: 0.1,
  maxEdges: 5_000,
  maxActiveTips: 84,
  maxTipAgeSteps: 360,
  worldRadius: 4.8,
  colonyRadius: 2.9,
  stepLength: 0.085,
  directionPersistence: 0.84,
  randomSteering: 0.2,
  boundarySteering: 0.7,
  attractionSteering: 1.25,
  attractionRadius: 1.15,
  fusionRadius: 0.13,
  fusionApproachThreshold: 0.05,
  branchChancePerStep: 0.022,
  minimumBranchAgeSteps: 8,
  branchAngleRadians: Math.PI * 0.27,
  initialRadius: 0.055,
  minimumRadius: 0.014,
  radiusDecayPerStep: 0.998,
  branchRadiusRatio: 0.76,
});

export class MyceliumSimulation {
  readonly nodes: NetworkNode[] = [];
  readonly edges: NetworkEdge[] = [];
  readonly tips: GrowthTip[] = [];
  readonly config: MyceliumConfig;

  fusionCount = 0;
  elapsedSeconds = 0;

  private accumulatorSeconds = 0;
  private random: () => number;
  private nextTipId = 0;
  private nextLineageId = 0;

  constructor(config: Partial<MyceliumConfig> = {}) {
    this.config = Object.freeze({ ...DEFAULT_MYCELIUM_CONFIG, ...config });
    this.random = createRandom(this.config.seed);
    this.reset(this.config.seed);
  }

  get activeTipCount(): number {
    return this.tips.reduce((count, tip) => count + Number(tip.active), 0);
  }

  get renderTimeSeconds(): number {
    return this.elapsedSeconds + this.accumulatorSeconds;
  }

  reset(seed: number = this.config.seed): void {
    this.nodes.length = 0;
    this.edges.length = 0;
    this.tips.length = 0;
    this.fusionCount = 0;
    this.elapsedSeconds = 0;
    this.accumulatorSeconds = 0;
    this.nextTipId = 0;
    this.nextLineageId = 0;
    this.random = createRandom(seed);
    this.createColonies();
  }

  update(deltaSeconds: number): void {
    const safeDelta = Math.min(deltaSeconds, this.config.maxFrameDeltaSeconds);
    this.accumulatorSeconds += Math.max(0, safeDelta);
    const stepSeconds = 1 / this.config.updatesPerSecond;
    let stepCount = 0;

    while (this.accumulatorSeconds >= stepSeconds) {
      this.step(stepSeconds);
      this.accumulatorSeconds -= stepSeconds;
      stepCount += 1;
      if (stepCount === this.config.maxStepsPerFrame) break;
    }
  }

  private createColonies(): void {
    for (let index = 0; index < this.config.colonyCount; index += 1) {
      const position = this.randomUnitVector().multiplyScalar(this.config.colonyRadius);
      const direction = position.clone().negate().normalize();
      direction.addScaledVector(this.randomUnitVector(), 0.32).normalize();
      const nodeId = this.addNode(position);
      this.addTip(nodeId, direction, this.config.initialRadius);
    }
  }

  private step(stepSeconds: number): void {
    if (this.edges.length >= this.config.maxEdges) {
      this.deactivateAllTips();
      return;
    }

    const currentTipCount = this.tips.length;
    for (let index = 0; index < currentTipCount; index += 1) {
      const tip = this.tips[index];
      if (tip?.active) this.growTip(tip);
    }

    this.fuseNearbyTips();
    this.removeInactiveTips();
    this.elapsedSeconds += stepSeconds;
  }

  private growTip(tip: GrowthTip): void {
    const startNode = this.nodes[tip.nodeId];
    if (!startNode) return;

    this.steerTip(tip, startNode.position);
    const endPosition = startNode.position
      .clone()
      .addScaledVector(tip.direction, this.config.stepLength);
    const endNodeId = this.addNode(endPosition);
    this.addEdge(tip.nodeId, endNodeId, tip.radius, 'growth');
    tip.nodeId = endNodeId;
    tip.ageSteps += 1;
    tip.radius = Math.max(
      this.config.minimumRadius,
      tip.radius * this.config.radiusDecayPerStep,
    );

    if (tip.ageSteps >= this.config.maxTipAgeSteps) tip.active = false;
    if (tip.active) this.maybeBranch(tip);
  }

  private steerTip(tip: GrowthTip, position: Vector3): void {
    const desired = tip.direction
      .clone()
      .multiplyScalar(this.config.directionPersistence);
    desired.addScaledVector(this.randomUnitVector(), this.config.randomSteering);
    this.addBoundarySteering(desired, position);

    const neighbor = this.findAttractionTarget(tip, position);
    if (neighbor) {
      const targetPosition = this.nodes[neighbor.nodeId]?.position;
      if (targetPosition) {
        desired.addScaledVector(
          targetPosition.clone().sub(position).normalize(),
          this.config.attractionSteering,
        );
      }
    }

    if (desired.lengthSq() > 0) tip.direction.copy(desired.normalize());
  }

  private addBoundarySteering(direction: Vector3, position: Vector3): void {
    const boundaryStart = this.config.worldRadius * 0.78;
    if (position.length() <= boundaryStart) return;

    const strength = (position.length() - boundaryStart) / (this.config.worldRadius - boundaryStart);
    direction.addScaledVector(
      position.clone().negate().normalize(),
      strength * this.config.boundarySteering,
    );
  }

  private findAttractionTarget(tip: GrowthTip, position: Vector3): GrowthTip | undefined {
    let nearest: GrowthTip | undefined;
    let nearestDistanceSq = this.config.attractionRadius ** 2;

    for (const candidate of this.tips) {
      if (!isFusionCandidate(tip, candidate)) continue;
      const candidatePosition = this.nodes[candidate.nodeId]?.position;
      if (!candidatePosition) continue;
      const distanceSq = position.distanceToSquared(candidatePosition);
      if (distanceSq >= nearestDistanceSq) continue;
      nearest = candidate;
      nearestDistanceSq = distanceSq;
    }

    return nearest;
  }

  private maybeBranch(tip: GrowthTip): void {
    if (tip.ageSteps < this.config.minimumBranchAgeSteps) return;
    if (this.activeTipCount >= this.config.maxActiveTips) return;
    if (this.random() >= this.config.branchChancePerStep) return;

    const axis = this.randomUnitVector();
    const angleSign = this.random() < 0.5 ? -1 : 1;
    const childDirection = tip.direction
      .clone()
      .applyAxisAngle(axis, this.config.branchAngleRadians * angleSign)
      .normalize();
    const childRadius = Math.max(
      this.config.minimumRadius,
      tip.radius * this.config.branchRadiusRatio,
    );
    this.addTip(tip.nodeId, childDirection, childRadius);
    tip.ageSteps = 0;
  }

  private fuseNearbyTips(): void {
    const claimedTipIds = new Set<number>();

    for (let firstIndex = 0; firstIndex < this.tips.length; firstIndex += 1) {
      const first = this.tips[firstIndex];
      if (!first?.active || claimedTipIds.has(first.id)) continue;

      const second = this.findFusionPartner(first, firstIndex + 1, claimedTipIds);
      if (!second) continue;
      this.fuseTips(first, second);
      claimedTipIds.add(first.id);
      claimedTipIds.add(second.id);
    }
  }

  private findFusionPartner(
    first: GrowthTip,
    startIndex: number,
    claimedTipIds: ReadonlySet<number>,
  ): GrowthTip | undefined {
    const firstPosition = this.nodes[first.nodeId]?.position;
    if (!firstPosition) return undefined;
    const fusionDistanceSq = this.config.fusionRadius ** 2;

    for (let index = startIndex; index < this.tips.length; index += 1) {
      const second = this.tips[index];
      if (!second?.active || claimedTipIds.has(second.id)) continue;
      if (!isFusionCandidate(first, second)) continue;
      const secondPosition = this.nodes[second.nodeId]?.position;
      if (!secondPosition) continue;
      if (firstPosition.distanceToSquared(secondPosition) > fusionDistanceSq) continue;
      if (this.tipsApproachEachOther(first, second)) return second;
    }

    return undefined;
  }

  private tipsApproachEachOther(first: GrowthTip, second: GrowthTip): boolean {
    const firstPosition = this.nodes[first.nodeId]?.position;
    const secondPosition = this.nodes[second.nodeId]?.position;
    if (!firstPosition || !secondPosition) return false;
    const towardSecond = secondPosition.clone().sub(firstPosition).normalize();
    const towardFirst = towardSecond.clone().negate();
    return (
      first.direction.dot(towardSecond) > this.config.fusionApproachThreshold &&
      second.direction.dot(towardFirst) > this.config.fusionApproachThreshold
    );
  }

  private fuseTips(first: GrowthTip, second: GrowthTip): void {
    const firstPosition = this.nodes[first.nodeId]?.position;
    const secondPosition = this.nodes[second.nodeId]?.position;
    if (!firstPosition || !secondPosition) return;

    const junctionPosition = firstPosition.clone().lerp(secondPosition, 0.5);
    const junctionNodeId = this.addNode(junctionPosition);
    const radius = Math.max(first.radius, second.radius);
    this.addEdge(first.nodeId, junctionNodeId, radius, 'fusion');
    this.addEdge(second.nodeId, junctionNodeId, radius, 'fusion');
    first.active = false;
    second.active = false;
    this.fusionCount += 1;
    this.spawnJunctionTip(junctionNodeId, radius);
  }

  private spawnJunctionTip(nodeId: number, parentRadius: number): void {
    if (this.activeTipCount >= this.config.maxActiveTips) return;
    const direction = this.randomUnitVector();
    const radius = Math.max(
      this.config.minimumRadius,
      parentRadius * this.config.branchRadiusRatio,
    );
    this.addTip(nodeId, direction, radius);
  }

  private addNode(position: Vector3): number {
    const id = this.nodes.length;
    this.nodes.push({ id, position: position.clone() });
    return id;
  }

  private addEdge(from: number, to: number, radius: number, kind: EdgeKind): void {
    if (this.edges.length >= this.config.maxEdges) return;
    this.edges.push({
      from,
      to,
      radius,
      kind,
      createdAtSeconds: this.elapsedSeconds,
    });
  }

  private addTip(nodeId: number, direction: Vector3, radius: number): void {
    this.tips.push({
      id: this.nextTipId,
      nodeId,
      lineageId: this.nextLineageId,
      direction: direction.clone().normalize(),
      radius,
      ageSteps: 0,
      active: true,
    });
    this.nextTipId += 1;
    this.nextLineageId += 1;
  }

  private randomUnitVector(): Vector3 {
    const y = this.random() * 2 - 1;
    const angle = this.random() * Math.PI * 2;
    const radial = Math.sqrt(1 - y * y);
    return new Vector3(Math.cos(angle) * radial, y, Math.sin(angle) * radial);
  }

  private removeInactiveTips(): void {
    for (let index = this.tips.length - 1; index >= 0; index -= 1) {
      if (!this.tips[index]?.active) this.tips.splice(index, 1);
    }
  }

  private deactivateAllTips(): void {
    for (const tip of this.tips) tip.active = false;
  }
}

function isFusionCandidate(first: GrowthTip, second: GrowthTip): boolean {
  return (
    second.active &&
    first.id !== second.id &&
    first.lineageId !== second.lineageId &&
    first.nodeId !== second.nodeId
  );
}
