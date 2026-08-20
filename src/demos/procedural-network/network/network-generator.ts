/**
 * One-shot procedural data generation for the WebGL2 network experiment.
 * It creates normalized points, a guaranteed connected graph, and compact
 * typed attributes consumed directly by the instanced tendril shader.
 */

import { createConnectedEdges } from './network-topology.ts';

export const MIN_POINT_COUNT = 16;
export const MAX_POINT_COUNT = 2_000;

const POINT_BOUNDARY = 0.43;
const LOOP_RATIO = 0.08;
const DECOYS_PER_POINT = 1;
const STABLE_KIND = 1;
const DECOY_KIND = 0;

export type NetworkOptions = {
  seed: number;
  pointCount: number;
};

export type GeneratedNetwork = {
  points: Float32Array;
  connections: Uint32Array;
  starts: Float32Array;
  ends: Float32Array;
  seeds: Float32Array;
  startTimes: Float32Array;
  durations: Float32Array;
  radii: Float32Array;
  kinds: Float32Array;
  stableConnectionCount: number;
  decoyCount: number;
  tendrilCount: number;
};

type TendrilBuffers = Pick<
  GeneratedNetwork,
  'starts' | 'ends' | 'seeds' | 'startTimes' | 'durations' | 'radii' | 'kinds'
>;

export function generateNetwork(options: Readonly<NetworkOptions>): GeneratedNetwork {
  const pointCount = clampPointCount(options.pointCount);
  const random = createRandom(options.seed);
  const points = createPoints(pointCount, random);
  const requestedLoops = Math.round(pointCount * LOOP_RATIO);
  const connections = createConnectedEdges(points, requestedLoops, random);
  const stableConnectionCount = connections.length / 2;
  const decoyCount = pointCount * DECOYS_PER_POINT;
  const tendrilCount = stableConnectionCount + decoyCount;
  const buffers = createTendrilBuffers(tendrilCount);

  writeStableTendrils(points, connections, buffers, random);
  writeDecoyTendrils(points, stableConnectionCount, buffers, random);

  return {
    points,
    connections,
    ...buffers,
    stableConnectionCount,
    decoyCount,
    tendrilCount,
  };
}

function clampPointCount(value: number): number {
  return Math.min(MAX_POINT_COUNT, Math.max(MIN_POINT_COUNT, Math.round(value)));
}

function createPoints(pointCount: number, random: () => number): Float32Array {
  const points = new Float32Array(pointCount * 3);
  for (let index = 0; index < points.length; index += 1) {
    points[index] = (random() * 2 - 1) * POINT_BOUNDARY;
  }
  return points;
}

function createTendrilBuffers(tendrilCount: number): TendrilBuffers {
  return {
    starts: new Float32Array(tendrilCount * 3),
    ends: new Float32Array(tendrilCount * 3),
    seeds: new Float32Array(tendrilCount),
    startTimes: new Float32Array(tendrilCount),
    durations: new Float32Array(tendrilCount),
    radii: new Float32Array(tendrilCount),
    kinds: new Float32Array(tendrilCount),
  };
}

function writeStableTendrils(
  points: Float32Array,
  connections: Uint32Array,
  buffers: TendrilBuffers,
  random: () => number,
): void {
  const connectionCount = connections.length / 2;
  for (let index = 0; index < connectionCount; index += 1) {
    const startIndex = connections[index * 2] ?? 0;
    const endIndex = connections[index * 2 + 1] ?? 0;
    copyPoint(points, startIndex, buffers.starts, index);
    copyPoint(points, endIndex, buffers.ends, index);
    buffers.seeds[index] = random() * 1_000;
    buffers.startTimes[index] = random() * 3 + (index / connectionCount) * 8;
    buffers.durations[index] = 2.5 + random() * 2.5;
    buffers.radii[index] = 0.0028 + random() * 0.0015;
    buffers.kinds[index] = STABLE_KIND;
  }
}

function writeDecoyTendrils(
  points: Float32Array,
  stableCount: number,
  buffers: TendrilBuffers,
  random: () => number,
): void {
  const pointCount = points.length / 3;
  for (let pointIndex = 0; pointIndex < pointCount; pointIndex += 1) {
    const tendrilIndex = stableCount + pointIndex;
    copyPoint(points, pointIndex, buffers.starts, tendrilIndex);
    writeDecoyEnd(points, pointIndex, buffers.ends, tendrilIndex, random);
    buffers.seeds[tendrilIndex] = random() * 1_000;
    buffers.startTimes[tendrilIndex] = random() * 9;
    buffers.durations[tendrilIndex] = 1.8 + random() * 2.2;
    buffers.radii[tendrilIndex] = 0.0018 + random() * 0.0012;
    buffers.kinds[tendrilIndex] = DECOY_KIND;
  }
}

function writeDecoyEnd(
  points: Float32Array,
  pointIndex: number,
  ends: Float32Array,
  tendrilIndex: number,
  random: () => number,
): void {
  const sourceOffset = pointIndex * 3;
  const targetOffset = tendrilIndex * 3;
  const direction = randomUnitVector(random);
  const length = 0.07 + random() * 0.2;
  for (let axis = 0; axis < 3; axis += 1) {
    const value = (points[sourceOffset + axis] ?? 0) + (direction[axis] ?? 0) * length;
    ends[targetOffset + axis] = Math.min(POINT_BOUNDARY, Math.max(-POINT_BOUNDARY, value));
  }
}

function copyPoint(
  source: Float32Array,
  sourceIndex: number,
  target: Float32Array,
  targetIndex: number,
): void {
  const sourceOffset = sourceIndex * 3;
  const targetOffset = targetIndex * 3;
  target[targetOffset] = source[sourceOffset] ?? 0;
  target[targetOffset + 1] = source[sourceOffset + 1] ?? 0;
  target[targetOffset + 2] = source[sourceOffset + 2] ?? 0;
}

function randomUnitVector(random: () => number): readonly [number, number, number] {
  const y = random() * 2 - 1;
  const angle = random() * Math.PI * 2;
  const radial = Math.sqrt(1 - y * y);
  return [Math.cos(angle) * radial, y, Math.sin(angle) * radial];
}

function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return (): number => {
    state = (1_664_525 * state + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}
