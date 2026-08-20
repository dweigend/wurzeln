/**
 * Determinism, bounds, and connectivity checks for generated shader data.
 * The upper-limit test protects the requested 2,000-point experiment size.
 */

import { describe, expect, test } from 'bun:test';
import { generateNetwork, MAX_POINT_COUNT } from './network-generator.ts';

describe('generateNetwork', () => {
  test('is deterministic and remains inside the normalized volume', () => {
    const first = generateNetwork({ seed: 42, pointCount: 128 });
    const second = generateNetwork({ seed: 42, pointCount: 128 });

    expect(first.points).toEqual(second.points);
    expect(first.connections).toEqual(second.connections);
    for (const coordinate of first.points) expect(Math.abs(coordinate)).toBeLessThanOrEqual(0.43);
  });

  test('connects every generated point', () => {
    const network = generateNetwork({ seed: 73, pointCount: 256 });
    expect(countConnectedPoints(network.points.length / 3, network.connections)).toBe(256);
    expect(network.stableConnectionCount).toBeGreaterThanOrEqual(255);
  });

  test('supports the requested 2,000-point upper limit', () => {
    const network = generateNetwork({ seed: 91, pointCount: MAX_POINT_COUNT });
    expect(network.points.length).toBe(MAX_POINT_COUNT * 3);
    expect(network.tendrilCount).toBe(network.stableConnectionCount + MAX_POINT_COUNT);
    expect(countConnectedPoints(MAX_POINT_COUNT, network.connections)).toBe(MAX_POINT_COUNT);
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
