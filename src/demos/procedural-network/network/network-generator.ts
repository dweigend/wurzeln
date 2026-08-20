/**
 * Creates immutable instance data for the procedural mycelium experiment.
 * Every connection belongs to one graph; continuous reinforcement values from
 * network traffic replace separate stable and exploratory geometry systems.
 */

import { createMycelialTopology } from './network-topology.ts';

export const MIN_POINT_COUNT = 16;
export const MAX_POINT_COUNT = 2_000;

const POINT_BOUNDARY = 0.43;
const GROWTH_WINDOW_SECONDS = 8;
const GROWTH_JITTER_SECONDS = 0.65;
const MIN_GROWTH_DURATION_SECONDS = 1.4;
const GROWTH_DURATION_VARIATION_SECONDS = 1.2;
const MIN_HYPHA_RADIUS = 0.00042;
const HYPHA_RADIUS_VARIATION = 0.00024;

export type NetworkOptions = {
  seed: number;
  pointCount: number;
};

export type PointNetworkOptions = {
  seed: number;
  points: Float32Array;
  resourcePointIndices?: readonly number[];
  minimumRadius?: number;
  radiusVariation?: number;
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
  reinforcements: Float32Array;
  connectionCount: number;
  reinforcedConnectionCount: number;
  hyphaCount: number;
};

type HyphaBuffers = Pick<
  GeneratedNetwork,
  'starts' | 'ends' | 'seeds' | 'startTimes' | 'durations' | 'radii' | 'reinforcements'
>;

type HyphaWriteContext = {
  points: Float32Array;
  connections: Uint32Array;
  growthSteps: Int32Array;
  sourceReinforcements: Float32Array;
  buffers: HyphaBuffers;
  random: () => number;
  minimumRadius: number;
  radiusVariation: number;
};

export function generateNetwork(options: Readonly<NetworkOptions>): GeneratedNetwork {
  const pointCount = clampPointCount(options.pointCount);
  const random = createRandom(options.seed);
  const points = createPoints(pointCount, random);
  return generateNetworkFromPoints({ seed: options.seed, points });
}

export function generateNetworkFromPoints(
  options: Readonly<PointNetworkOptions>,
): GeneratedNetwork {
  const random = createRandom(options.seed);
  const topology = createMycelialTopology(options.points, options.resourcePointIndices);
  const connectionCount = topology.connections.length / 2;
  const buffers = createHyphaBuffers(connectionCount);

  writeHyphae({
    points: options.points,
    connections: topology.connections,
    growthSteps: topology.growthSteps,
    sourceReinforcements: topology.reinforcements,
    buffers,
    random,
    minimumRadius: options.minimumRadius ?? MIN_HYPHA_RADIUS,
    radiusVariation: options.radiusVariation ?? HYPHA_RADIUS_VARIATION,
  });

  return {
    points: options.points,
    connections: topology.connections,
    ...buffers,
    connectionCount,
    reinforcedConnectionCount: topology.reinforcedConnectionCount,
    hyphaCount: connectionCount,
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

function createHyphaBuffers(hyphaCount: number): HyphaBuffers {
  return {
    starts: new Float32Array(hyphaCount * 3),
    ends: new Float32Array(hyphaCount * 3),
    seeds: new Float32Array(hyphaCount),
    startTimes: new Float32Array(hyphaCount),
    durations: new Float32Array(hyphaCount),
    radii: new Float32Array(hyphaCount),
    reinforcements: new Float32Array(hyphaCount),
  };
}

function writeHyphae(context: Readonly<HyphaWriteContext>): void {
  const maximumStep = Math.max(1, ...context.growthSteps);
  const connectionCount = context.connections.length / 2;

  for (let edge = 0; edge < connectionCount; edge += 1) {
    const start = context.connections[edge * 2] ?? 0;
    const end = context.connections[edge * 2 + 1] ?? 0;
    copyPoint(context.points, start, context.buffers.starts, edge);
    copyPoint(context.points, end, context.buffers.ends, edge);
    context.buffers.seeds[edge] = context.random() * 1_000;
    context.buffers.startTimes[edge] = edgeStartTime(start, end, context, maximumStep);
    context.buffers.durations[edge] =
      MIN_GROWTH_DURATION_SECONDS + context.random() * GROWTH_DURATION_VARIATION_SECONDS;
    context.buffers.radii[edge] =
      context.minimumRadius + context.random() * context.radiusVariation;
    context.buffers.reinforcements[edge] = context.sourceReinforcements[edge] ?? 0;
  }
}

function edgeStartTime(
  start: number,
  end: number,
  context: Readonly<HyphaWriteContext>,
  maximumStep: number,
): number {
  const growthStep = Math.min(context.growthSteps[start] ?? 0, context.growthSteps[end] ?? 0);
  const scheduled = (growthStep / maximumStep) * GROWTH_WINDOW_SECONDS;
  return scheduled + context.random() * GROWTH_JITTER_SECONDS;
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

function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return (): number => {
    state = (1_664_525 * state + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}
