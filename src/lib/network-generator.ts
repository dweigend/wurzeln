/**
 * Creates immutable render data for volume and caller-provided mycelium points.
 * Topology remains CPU-owned setup work; the returned typed arrays are uploaded
 * by concrete views and are not mutated during render frames.
 */

import { createMycelialTopology } from './network-topology.ts';
import { createRandom } from './random.ts';
import {
  type GeneratedNetwork,
  type NetworkGenerationSettings,
  VOLUME_POINT_COUNT_LIMITS,
} from './settings.ts';

const POINT_BOUNDARY = 0.43;
const GROWTH_WINDOW_SECONDS = 8;
const GROWTH_JITTER_SECONDS = 0.65;
const MIN_GROWTH_DURATION_SECONDS = 1.4;
const GROWTH_DURATION_VARIATION_SECONDS = 1.2;
const MIN_HYPHA_RADIUS = 0.00042;
const HYPHA_RADIUS_VARIATION = 0.00024;

type HyphaBuffers = Pick<
  GeneratedNetwork,
  | 'starts'
  | 'ends'
  | 'seeds'
  | 'startTimesSeconds'
  | 'durationsSeconds'
  | 'radii'
  | 'reinforcements'
>;

type HyphaWriteContext = Readonly<{
  points: Float32Array;
  connections: Uint32Array;
  growthSteps: Int32Array;
  sourceReinforcements: Float32Array;
  buffers: HyphaBuffers;
  random: () => number;
  minimumRadius: number;
  radiusVariation: number;
}>;

export function createNetwork(settings: NetworkGenerationSettings): GeneratedNetwork {
  const points = settings.kind === 'volume'
    ? createVolumePoints(settings.pointCount, settings.seed)
    : settings.points;
  const resourcePointIndices = settings.kind === 'points'
    ? settings.resourcePointIndices
    : undefined;
  const topology = createMycelialTopology(points, resourcePointIndices);
  const hyphaCount = topology.connections.length / 2;
  const buffers = createHyphaBuffers(hyphaCount);

  writeHyphae({
    points,
    connections: topology.connections,
    growthSteps: topology.growthSteps,
    sourceReinforcements: topology.reinforcements,
    buffers,
    random: createRandom(settings.seed),
    minimumRadius: settings.kind === 'points' ? settings.minimumRadius : MIN_HYPHA_RADIUS,
    radiusVariation: settings.kind === 'points'
      ? settings.radiusVariation
      : HYPHA_RADIUS_VARIATION,
  });

  return {
    points,
    connections: topology.connections,
    ...buffers,
    hyphaCount,
    reinforcedHyphaCount: topology.reinforcedHyphaCount,
  };
}

function createVolumePoints(requestedPointCount: number, seed: number): Float32Array {
  const pointCount = clampPointCount(requestedPointCount);
  const random = createRandom(seed);
  const points = new Float32Array(pointCount * 3);
  for (let index = 0; index < points.length; index += 1) {
    points[index] = (random() * 2 - 1) * POINT_BOUNDARY;
  }
  return points;
}

function clampPointCount(value: number): number {
  return Math.min(
    VOLUME_POINT_COUNT_LIMITS.maximum,
    Math.max(VOLUME_POINT_COUNT_LIMITS.minimum, Math.round(value)),
  );
}

function createHyphaBuffers(hyphaCount: number): HyphaBuffers {
  return {
    starts: new Float32Array(hyphaCount * 3),
    ends: new Float32Array(hyphaCount * 3),
    seeds: new Float32Array(hyphaCount),
    startTimesSeconds: new Float32Array(hyphaCount),
    durationsSeconds: new Float32Array(hyphaCount),
    radii: new Float32Array(hyphaCount),
    reinforcements: new Float32Array(hyphaCount),
  };
}

function writeHyphae(context: HyphaWriteContext): void {
  const maximumStep = Math.max(1, ...context.growthSteps);
  const hyphaCount = context.connections.length / 2;

  for (let hyphaIndex = 0; hyphaIndex < hyphaCount; hyphaIndex += 1) {
    writeHyphaEndpoints(context, hyphaIndex);
    context.buffers.seeds[hyphaIndex] = context.random() * 1_000;
    context.buffers.startTimesSeconds[hyphaIndex] = getStartTimeSeconds(
      context,
      hyphaIndex,
      maximumStep,
    );
    context.buffers.durationsSeconds[hyphaIndex] =
      MIN_GROWTH_DURATION_SECONDS + context.random() * GROWTH_DURATION_VARIATION_SECONDS;
    context.buffers.radii[hyphaIndex] =
      context.minimumRadius + context.random() * context.radiusVariation;
    context.buffers.reinforcements[hyphaIndex] =
      context.sourceReinforcements[hyphaIndex] ?? 0;
  }
}

function writeHyphaEndpoints(context: HyphaWriteContext, hyphaIndex: number): void {
  const startPointIndex = context.connections[hyphaIndex * 2] ?? 0;
  const endPointIndex = context.connections[hyphaIndex * 2 + 1] ?? 0;
  const startOffset = startPointIndex * 3;
  const endOffset = endPointIndex * 3;
  const targetOffset = hyphaIndex * 3;

  for (let axis = 0; axis < 3; axis += 1) {
    context.buffers.starts[targetOffset + axis] = context.points[startOffset + axis] ?? 0;
    context.buffers.ends[targetOffset + axis] = context.points[endOffset + axis] ?? 0;
  }
}

function getStartTimeSeconds(
  context: HyphaWriteContext,
  hyphaIndex: number,
  maximumStep: number,
): number {
  const start = context.connections[hyphaIndex * 2] ?? 0;
  const end = context.connections[hyphaIndex * 2 + 1] ?? 0;
  const growthStep = Math.min(context.growthSteps[start] ?? 0, context.growthSteps[end] ?? 0);
  const scheduled = (growthStep / maximumStep) * GROWTH_WINDOW_SECONDS;
  return scheduled + context.random() * GROWTH_JITTER_SECONDS;
}
