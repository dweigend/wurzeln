/**
 * Creates tree-root resources and additional points below a shared height field.
 * The generic graph builder then derives one connected, reinforced network.
 */

import {
  generateNetworkFromPoints,
  type GeneratedNetwork,
} from '../../procedural-network/network/network-generator.ts';
import { createRandom } from '../generation/random.ts';
import { sampleHeight, type HeightField } from '../terrain/height-field.ts';
import type { TreePlacement } from '../trees/tree-placement.ts';

const ROOT_DEPTH = 0.24;
const MINIMUM_DEPTH = 0.35;
const DEPTH_RATIO = 0.13;

export type SubsurfaceNetwork = {
  network: GeneratedNetwork;
  resourcePointIndices: number[];
};

type PointCoordinates = {
  x: number;
  y: number;
  z: number;
};

export function createSubsurfaceNetwork(
  field: Readonly<HeightField>,
  trees: readonly TreePlacement[],
  requestedPointCount: number,
  seed: number,
): SubsurfaceNetwork {
  const pointCount = Math.max(trees.length, requestedPointCount);
  const points = new Float32Array(pointCount * 3);
  const resources = trees.map((tree, index) => {
    writePoint(points, index, { x: tree.x, y: tree.y - ROOT_DEPTH, z: tree.z });
    return index;
  });
  writeUndergroundPoints(field, points, trees.length, seed);

  return {
    network: generateNetworkFromPoints({
      seed,
      points,
      resourcePointIndices: resources,
      minimumRadius: 0.008,
      radiusVariation: 0.006,
    }),
    resourcePointIndices: resources,
  };
}

function writeUndergroundPoints(
  field: Readonly<HeightField>,
  points: Float32Array,
  startIndex: number,
  seed: number,
): void {
  const random = createRandom(seed);
  const boundary = field.size * 0.46;
  for (let index = startIndex; index < points.length / 3; index += 1) {
    const x = (random() * 2 - 1) * boundary;
    const z = (random() * 2 - 1) * boundary;
    const depth = MINIMUM_DEPTH + Math.pow(random(), 1.8) * field.size * DEPTH_RATIO;
    writePoint(points, index, { x, y: sampleHeight(field, x, z) - depth, z });
  }
}

function writePoint(
  points: Float32Array,
  index: number,
  coordinates: Readonly<PointCoordinates>,
): void {
  const offset = index * 3;
  points[offset] = coordinates.x;
  points[offset + 1] = coordinates.y;
  points[offset + 2] = coordinates.z;
}
