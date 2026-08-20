/**
 * Determinism and surface-bound checks for the landscape MVP generators.
 * These tests cover shared height sampling, trees, and underground points.
 */

import { describe, expect, test } from 'bun:test';
import { createSubsurfaceNetwork } from '../network/subsurface-network.ts';
import { createHeightField, sampleHeight } from '../terrain/height-field.ts';
import { createTreePlacements } from '../trees/tree-placement.ts';

describe('landscape generation', () => {
  test('creates a deterministic height field and tree distribution', () => {
    const firstField = createHeightField({ size: 24, seed: 42, resolution: 33 });
    const secondField = createHeightField({ size: 24, seed: 42, resolution: 33 });
    const firstTrees = createTreePlacements(firstField, 20, 43);
    const secondTrees = createTreePlacements(secondField, 20, 43);

    expect(firstField.heights).toEqual(secondField.heights);
    expect(firstTrees).toEqual(secondTrees);
    expect(firstTrees).toHaveLength(20);
  });

  test('places roots and network points below the terrain surface', () => {
    const field = createHeightField({ size: 20, seed: 73, resolution: 33 });
    const trees = createTreePlacements(field, 12, 74);
    const { network, resourcePointIndices } = createSubsurfaceNetwork(field, trees, 128, 75);

    expect(resourcePointIndices).toHaveLength(trees.length);
    for (let point = 0; point < network.points.length / 3; point += 1) {
      const offset = point * 3;
      const x = network.points[offset] ?? 0;
      const y = network.points[offset + 1] ?? 0;
      const z = network.points[offset + 2] ?? 0;
      expect(y).toBeLessThan(sampleHeight(field, x, z));
    }
  });
});

