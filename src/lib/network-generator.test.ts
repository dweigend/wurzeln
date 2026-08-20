/**
 * Determinism, bounds, connectivity, and reinforcement checks for shader data.
 * The upper-limit test protects the requested 2,000-point experiment size.
 */

import { describe, expect, test } from 'bun:test';
import { createNetwork } from './network-generator.ts';
import { VOLUME_POINT_COUNT_LIMITS } from './settings.ts';

describe('createNetwork', () => {
  test('is deterministic and remains inside the normalized volume', () => {
    const first = createNetwork({ kind: 'volume', seed: 42, pointCount: 128 });
    const second = createNetwork({ kind: 'volume', seed: 42, pointCount: 128 });

    expect(first.points).toEqual(second.points);
    expect(first.connections).toEqual(second.connections);
    expect(first.reinforcements).toEqual(second.reinforcements);
    for (const coordinate of first.points) expect(Math.abs(coordinate)).toBeLessThanOrEqual(0.43);
  });

  test('connects every generated point', () => {
    const network = createNetwork({ kind: 'volume', seed: 73, pointCount: 256 });
    expect(countConnectedPoints(network.points.length / 3, network.connections)).toBe(256);
    expect(network.hyphaCount).toBeGreaterThanOrEqual(255);
    expect(network.hyphaCount).toBe(network.connections.length / 2);
  });

  test('derives a continuous transport hierarchy from the same graph', () => {
    const network = createNetwork({ kind: 'volume', seed: 84, pointCount: 512 });
    const distinctWeights = new Set(
      Array.from(network.reinforcements, (weight) => weight.toFixed(3)),
    );

    expect(network.reinforcements.length).toBe(network.hyphaCount);
    expect(Math.min(...network.reinforcements)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...network.reinforcements)).toBeLessThanOrEqual(1);
    expect(distinctWeights.size).toBeGreaterThan(4);
    expect(network.reinforcedHyphaCount).toBeGreaterThan(0);
    expect(network.reinforcedHyphaCount).toBeLessThan(network.hyphaCount);
  });

  test('supports the requested 2,000-point upper limit', () => {
    const network = createNetwork({
      kind: 'volume',
      seed: 91,
      pointCount: VOLUME_POINT_COUNT_LIMITS.maximum,
    });
    expect(network.points.length).toBe(VOLUME_POINT_COUNT_LIMITS.maximum * 3);
    expect(network.hyphaCount).toBe(network.connections.length / 2);
    expect(
      countConnectedPoints(VOLUME_POINT_COUNT_LIMITS.maximum, network.connections),
    ).toBe(VOLUME_POINT_COUNT_LIMITS.maximum);
  });

  test('accepts explicit resource points for landscape networks', () => {
    const points = new Float32Array([
      -1, 0, 0,
      0, -1, 0,
      1, 0, 0,
      0, 0, 1,
    ]);
    const network = createNetwork({
      kind: 'points',
      seed: 12,
      points,
      resourcePointIndices: [0, 2],
      minimumRadius: 0.01,
      radiusVariation: 0,
    });

    expect(network.points).toBe(points);
    expect(network.hyphaCount).toBeGreaterThanOrEqual(points.length / 3 - 1);
    expect(Array.from(network.radii).every((radius) => Math.abs(radius - 0.01) < 0.000_001)).toBe(
      true,
    );
  });
});

function countConnectedPoints(pointCount: number, connections: Uint32Array): number {
  const adjacency = Array.from({ length: pointCount }, () => [] as number[]);
  for (let index = 0; index < connections.length; index += 2) {
    const first = connections[index] ?? 0;
    const second = connections[index + 1] ?? 0;
    adjacency[first]?.push(second);
    adjacency[second]?.push(first);
  }

  const visited = new Set<number>([0]);
  const pending = [0];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) break;
    for (const neighbor of adjacency[current] ?? []) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      pending.push(neighbor);
    }
  }
  return visited.size;
}
