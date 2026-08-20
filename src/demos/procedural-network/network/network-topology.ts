/**
 * Connected topology generation for procedural point networks.
 * A deterministic minimum spanning tree guarantees connectivity; a small
 * number of local extra edges adds loops without running a frame simulation.
 */

export type RandomSource = () => number;

const LOOP_CANDIDATE_SAMPLES = 24;

export function createConnectedEdges(
  points: Float32Array,
  loopCount: number,
  random: RandomSource,
): Uint32Array {
  const edges = createMinimumSpanningTree(points);
  addLocalLoops(points, edges, loopCount, random);
  return Uint32Array.from(edges);
}

function createMinimumSpanningTree(points: Float32Array): number[] {
  const pointCount = points.length / 3;
  const visited = new Uint8Array(pointCount);
  const distances = new Float64Array(pointCount);
  const parents = new Int32Array(pointCount);
  distances.fill(Number.POSITIVE_INFINITY);
  parents.fill(-1);
  distances[0] = 0;

  const edges: number[] = [];
  for (let step = 0; step < pointCount; step += 1) {
    const current = findNearestUnvisited(distances, visited);
    if (current < 0) break;
    visited[current] = 1;
    const parent = parents[current] ?? -1;
    if (parent >= 0) edges.push(parent, current);
    updateNearestDistances(points, current, distances, parents, visited);
  }
  return edges;
}

function findNearestUnvisited(distances: Float64Array, visited: Uint8Array): number {
  let nearest = -1;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < distances.length; index += 1) {
    const distance = distances[index] ?? Number.POSITIVE_INFINITY;
    if (visited[index] === 1 || distance >= nearestDistance) continue;
    nearest = index;
    nearestDistance = distance;
  }
  return nearest;
}

function updateNearestDistances(
  points: Float32Array,
  current: number,
  distances: Float64Array,
  parents: Int32Array,
  visited: Uint8Array,
): void {
  for (let candidate = 0; candidate < distances.length; candidate += 1) {
    if (visited[candidate] === 1) continue;
    const distance = distanceSquared(points, current, candidate);
    if (distance >= (distances[candidate] ?? Number.POSITIVE_INFINITY)) continue;
    distances[candidate] = distance;
    parents[candidate] = current;
  }
}

function addLocalLoops(
  points: Float32Array,
  edges: number[],
  requestedCount: number,
  random: RandomSource,
): void {
  const existing = createEdgeKeySet(edges);
  const pointCount = points.length / 3;
  const maximumAttempts = requestedCount * LOOP_CANDIDATE_SAMPLES;
  let added = 0;

  for (let attempt = 0; attempt < maximumAttempts && added < requestedCount; attempt += 1) {
    const start = Math.floor(random() * pointCount);
    const end = findLocalCandidate(points, start, existing, random);
    if (end < 0) continue;
    existing.add(edgeKey(start, end));
    edges.push(start, end);
    added += 1;
  }
}

function findLocalCandidate(
  points: Float32Array,
  start: number,
  existing: ReadonlySet<string>,
  random: RandomSource,
): number {
  const pointCount = points.length / 3;
  let nearest = -1;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (let sample = 0; sample < LOOP_CANDIDATE_SAMPLES; sample += 1) {
    const candidate = Math.floor(random() * pointCount);
    if (candidate === start || existing.has(edgeKey(start, candidate))) continue;
    const distance = distanceSquared(points, start, candidate);
    if (distance >= nearestDistance) continue;
    nearest = candidate;
    nearestDistance = distance;
  }
  return nearest;
}

function createEdgeKeySet(edges: readonly number[]): Set<string> {
  const keys = new Set<string>();
  for (let index = 0; index < edges.length; index += 2) {
    keys.add(edgeKey(edges[index] ?? 0, edges[index + 1] ?? 0));
  }
  return keys;
}

function edgeKey(first: number, second: number): string {
  return first < second ? `${first}:${second}` : `${second}:${first}`;
}

function distanceSquared(points: Float32Array, first: number, second: number): number {
  const firstOffset = first * 3;
  const secondOffset = second * 3;
  const x = (points[firstOffset] ?? 0) - (points[secondOffset] ?? 0);
  const y = (points[firstOffset + 1] ?? 0) - (points[secondOffset + 1] ?? 0);
  const z = (points[firstOffset + 2] ?? 0) - (points[secondOffset + 2] ?? 0);
  return x * x + y * y + z * z;
}
