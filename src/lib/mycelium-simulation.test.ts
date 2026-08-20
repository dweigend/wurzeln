/**
 * Focused invariants for deterministic growth and permanent graph fusion.
 * These tests validate simulation data only; browser rendering is covered by
 * the production build and browser smoke check.
 */

import { describe, expect, test } from 'bun:test';
import { MyceliumSimulation } from './mycelium-simulation.ts';

describe('MyceliumSimulation', () => {
  test('creates a deterministic graph with stable fusion edges', () => {
    const first = runSimulation(42);
    const second = runSimulation(42);

    expect(first.edges.length).toBeGreaterThan(0);
    expect(first.fusionCount).toBeGreaterThan(0);
    expect(first.edges.some((edge) => edge.kind === 'fusion')).toBe(true);
    expect(createDigest(first)).toEqual(createDigest(second));
    expectGraphReferencesToBeValid(first);
  });
});

function runSimulation(seed: number): MyceliumSimulation {
  const simulation = new MyceliumSimulation({
    seed,
    colonyCount: 10,
    maxEdges: 2_000,
    maxActiveTips: 50,
    branchChancePerStep: 0.025,
  });
  for (let index = 0; index < 220; index += 1) simulation.update(1 / 15);
  return simulation;
}

function createDigest(simulation: MyceliumSimulation): string {
  return JSON.stringify({
    fusionCount: simulation.fusionCount,
    nodes: simulation.nodes.slice(0, 40).map((node) => node.position.toArray()),
    edges: simulation.edges.slice(0, 80),
  });
}

function expectGraphReferencesToBeValid(simulation: MyceliumSimulation): void {
  for (const edge of simulation.edges) {
    expect(simulation.nodes[edge.from]).toBeDefined();
    expect(simulation.nodes[edge.to]).toBeDefined();
  }
}
