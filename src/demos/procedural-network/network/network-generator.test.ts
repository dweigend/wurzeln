/**
 * Determinism, bounds, connectivity, and reinforcement checks for shader data.
 * The upper-limit test protects the requested 2,000-point experiment size.
 */

import { describe, expect, test } from 'bun:test';
import {
  generateNetwork,
  generateNetworkFromPoints,
  MAX_POINT_COUNT,
} from './network-generator.ts';

describe('generateNetwork', () => {
  test('is deterministic and remains inside the normalized volume', () => {
    const first = generateNetwork({ seed: 42, pointCount: 128 });
    const second = generateNetwork({ seed: 42, pointCount: 128 });

    expect(first.points).toEqual(second.points);
    expect(first.connections).toEqual(second.connections);
    expect(first.reinforcements).toEqual(second.reinforcements);
    for (const coordinate of first.points) expect(Math.abs(coordinate)).toBeLessThanOrEqual(0.43);
  });

  test('connects every generated point', () => {
    const network = generateNetwork({ seed: 73, pointCount: 256 });
    expect(countConnectedPoints(network.points.length / 3, network.connections)).toBe(256);
    expect(network.connectionCount).toBeGreaterThanOrEqual(255);
    expect(network.hyphaCount).toBe(network.connectionCount);
  });

  test('derives a continuous transport hierarchy from the same graph', () => {
    const network = generateNetwork({ seed: 84, pointCount: 512 });
    const distinctWeights = new Set(
      Array.from(network.reinforcements, (weight) => weight.toFixed(3)),
    );

    expect(network.reinforcements.length).toBe(network.connectionCount);
    expect(Math.min(...network.reinforcements)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...network.reinforcements)).toBeLessThanOrEqual(1);
    expect(distinctWeights.size).toBeGreaterThan(4);
    expect(network.reinforcedConnectionCount).toBeGreaterThan(0);
    expect(network.reinforcedConnectionCount).toBeLessThan(network.connectionCount);
  });

  test('supports the requested 2,000-point upper limit', () => {
    const network = generateNetwork({ seed: 91, pointCount: MAX_POINT_COUNT });
    expect(network.points.length).toBe(MAX_POINT_COUNT * 3);
    expect(network.hyphaCount).toBe(network.connections.length / 2);
    expect(countConnectedPoints(MAX_POINT_COUNT, network.connections)).toBe(MAX_POINT_COUNT);
  });

  test('accepts explicit resource points for landscape networks', () => {
    const points = new Float32Array([
      -1, 0, 0,
      0, -1, 0,
      1, 0, 0,
      0, 0, 1,
    ]);
    const network = generateNetworkFromPoints({
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
