/**
 * Places deterministic tree instances on sufficiently level terrain.
 * Placements also define the resource origins for the underground network.
 */

import { createRandom } from '../generation/random.ts';
import { sampleHeight, sampleSlope, type HeightField } from '../terrain/height-field.ts';

const EDGE_MARGIN_RATIO = 0.08;
const MAX_SLOPE = 0.7;
const ATTEMPTS_PER_TREE = 40;

export type TreePlacement = {
  x: number;
  y: number;
  z: number;
  rotation: number;
  scale: number;
  revealDelay: number;
};

type PlacementCandidate = {
  field: Readonly<HeightField>;
  placements: readonly TreePlacement[];
  x: number;
  z: number;
  minimumDistance: number;
};

type PlacementContext = {
  field: Readonly<HeightField>;
  x: number;
  z: number;
  random: () => number;
  index: number;
  count: number;
};

export function createTreePlacements(
  field: Readonly<HeightField>,
  count: number,
  seed: number,
): TreePlacement[] {
  const random = createRandom(seed);
  const placements: TreePlacement[] = [];
  const limit = field.size * (0.5 - EDGE_MARGIN_RATIO);
  const minimumDistance = (field.size / Math.sqrt(Math.max(1, count))) * 0.45;

  for (let attempt = 0; attempt < count * ATTEMPTS_PER_TREE; attempt += 1) {
    if (placements.length >= count) break;
    const x = (random() * 2 - 1) * limit;
    const z = (random() * 2 - 1) * limit;
    if (!canPlaceTree({ field, placements, x, z, minimumDistance })) continue;
    placements.push(createPlacement({ field, x, z, random, index: placements.length, count }));
  }
  return placements;
}

function canPlaceTree(candidate: Readonly<PlacementCandidate>): boolean {
  if (sampleSlope(candidate.field, candidate.x, candidate.z) > MAX_SLOPE) return false;
  return candidate.placements.every(
    (tree) =>
      Math.hypot(tree.x - candidate.x, tree.z - candidate.z) >= candidate.minimumDistance,
  );
}

function createPlacement(context: Readonly<PlacementContext>): TreePlacement {
  return {
    x: context.x,
    y: sampleHeight(context.field, context.x, context.z),
    z: context.z,
    rotation: context.random() * Math.PI * 2,
    scale: 0.72 + context.random() * 0.48,
    revealDelay: context.count > 1 ? (context.index / (context.count - 1)) * 0.64 : 0,
  };
}
