/**
 * Builds one connected mycelial graph and derives continuous transport weights.
 * Local edges form the exploratory web; traffic through that same graph selects
 * reinforced cords without introducing a second connection category.
 */

export type MycelialTopology = {
  connections: Uint32Array;
  growthSteps: Int32Array;
  reinforcements: Float32Array;
  reinforcedConnectionCount: number;
};

type Neighbor = {
  node: number;
  edge: number;
};

type GrowthTree = {
  steps: Int32Array;
  parentNodes: Int32Array;
  parentEdges: Int32Array;
};

type TrafficContext = {
  adjacency: readonly Neighbor[][];
  resources: readonly number[];
  traffic: Float64Array;
  routeWeight: number;
};

const LOCAL_NEIGHBORS_PER_POINT = 3;
const MIN_RESOURCE_COUNT = 4;
const MAX_RESOURCE_COUNT = 12;
const RESOURCE_DENSITY_DIVISOR = 5;
const REINFORCED_THRESHOLD = 0.42;

export function createMycelialTopology(
  points: Float32Array,
  resourcePointIndices?: readonly number[],
): MycelialTopology {
  const connections = createConnectedLocalGraph(points);
  const pointCount = points.length / 3;
  const adjacency = createAdjacency(pointCount, connections);
  const resources = resourcePointIndices
    ? normalizeResourcePoints(resourcePointIndices, pointCount)
    : selectResourcePoints(points, resourceCountFor(pointCount));
  const growthTree = createGrowthTree(adjacency, resources);
  const reinforcements = calculateReinforcements(adjacency, resources, growthTree);

  return {
    connections,
    growthSteps: growthTree.steps,
    reinforcements,
    reinforcedConnectionCount: countReinforcedConnections(reinforcements),
  };
}

function normalizeResourcePoints(resources: readonly number[], pointCount: number): number[] {
  const valid = resources.filter(
    (point) => Number.isInteger(point) && point >= 0 && point < pointCount,
  );
  const unique = [...new Set(valid)];
  return unique.length > 0 ? unique : [0];
}

function createConnectedLocalGraph(points: Float32Array): Uint32Array {
  const edges = createMinimumSpanningTree(points);
  const existing = createEdgeKeySet(edges);
  addLocalConnections(points, edges, existing);
  return Uint32Array.from(edges);
}

function addLocalConnections(points: Float32Array, edges: number[], existing: Set<string>): void {
  const pointCount = points.length / 3;
  for (let point = 0; point < pointCount; point += 1) {
    const neighbors = findNearestNeighbors(points, point, LOCAL_NEIGHBORS_PER_POINT);
    for (const neighbor of neighbors) addUniqueEdge(edges, existing, point, neighbor);
  }
}

function findNearestNeighbors(points: Float32Array, source: number, count: number): number[] {
  const nearestNodes = new Int32Array(count);
  const nearestDistances = new Float64Array(count);
  nearestNodes.fill(-1);
  nearestDistances.fill(Number.POSITIVE_INFINITY);

  for (let candidate = 0; candidate < points.length / 3; candidate += 1) {
    if (candidate === source) continue;
    insertNeighbor(candidate, distanceSquared(points, source, candidate), nearestNodes, nearestDistances);
  }
  return Array.from(nearestNodes).filter((node) => node >= 0);
}

function insertNeighbor(
  node: number,
  distance: number,
  nearestNodes: Int32Array,
  nearestDistances: Float64Array,
): void {
  for (let rank = 0; rank < nearestDistances.length; rank += 1) {
    if (distance >= (nearestDistances[rank] ?? Number.POSITIVE_INFINITY)) continue;
    shiftNeighbors(rank, nearestNodes, nearestDistances);
    nearestNodes[rank] = node;
    nearestDistances[rank] = distance;
    return;
  }
}

function shiftNeighbors(
  insertAt: number,
  nearestNodes: Int32Array,
  nearestDistances: Float64Array,
): void {
  for (let rank = nearestNodes.length - 1; rank > insertAt; rank -= 1) {
    nearestNodes[rank] = nearestNodes[rank - 1] ?? -1;
    nearestDistances[rank] = nearestDistances[rank - 1] ?? Number.POSITIVE_INFINITY;
  }
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
    if ((parents[current] ?? -1) >= 0) edges.push(parents[current] ?? 0, current);
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

function addUniqueEdge(edges: number[], existing: Set<string>, first: number, second: number): void {
  const key = edgeKey(first, second);
  if (existing.has(key)) return;
  existing.add(key);
  edges.push(first, second);
}

function createAdjacency(pointCount: number, connections: Uint32Array): Neighbor[][] {
  const adjacency = Array.from({ length: pointCount }, () => [] as Neighbor[]);
  for (let edge = 0; edge < connections.length / 2; edge += 1) {
    const first = connections[edge * 2] ?? 0;
    const second = connections[edge * 2 + 1] ?? 0;
    adjacency[first]?.push({ node: second, edge });
    adjacency[second]?.push({ node: first, edge });
  }
  return adjacency;
}

function resourceCountFor(pointCount: number): number {
  const scaled = Math.round(Math.sqrt(pointCount) / RESOURCE_DENSITY_DIVISOR);
  return Math.min(MAX_RESOURCE_COUNT, Math.max(MIN_RESOURCE_COUNT, scaled));
}

function selectResourcePoints(points: Float32Array, count: number): number[] {
  const selected = [findPointNearestCenter(points)];
  const nearestDistances = new Float64Array(points.length / 3);
  nearestDistances.fill(Number.POSITIVE_INFINITY);

  while (selected.length < count) {
    updateDistancesToSelection(points, selected.at(-1) ?? 0, nearestDistances);
    selected.push(findFarthestPoint(nearestDistances, selected));
  }
  return selected;
}

function findPointNearestCenter(points: Float32Array): number {
  let nearest = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let point = 0; point < points.length / 3; point += 1) {
    const distance = distanceFromOriginSquared(points, point);
    if (distance >= nearestDistance) continue;
    nearest = point;
    nearestDistance = distance;
  }
  return nearest;
}

function updateDistancesToSelection(
  points: Float32Array,
  selected: number,
  nearestDistances: Float64Array,
): void {
  for (let point = 0; point < nearestDistances.length; point += 1) {
    nearestDistances[point] = Math.min(
      nearestDistances[point] ?? Number.POSITIVE_INFINITY,
      distanceSquared(points, selected, point),
    );
  }
}

function findFarthestPoint(distances: Float64Array, selected: readonly number[]): number {
  const selectedSet = new Set(selected);
  let farthest = 0;
  for (let point = 1; point < distances.length; point += 1) {
    if (selectedSet.has(point)) continue;
    if ((distances[point] ?? 0) > (distances[farthest] ?? 0)) farthest = point;
  }
  return farthest;
}

function createGrowthTree(adjacency: readonly Neighbor[][], resources: readonly number[]): GrowthTree {
  const steps = new Int32Array(adjacency.length);
  const parentNodes = new Int32Array(adjacency.length);
  const parentEdges = new Int32Array(adjacency.length);
  steps.fill(-1);
  parentNodes.fill(-1);
  parentEdges.fill(-1);
  const queue = [...resources];
  for (const resource of resources) steps[resource] = 0;

  const tree = { steps, parentNodes, parentEdges };
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    visitGrowthNeighbors(queue[cursor] ?? 0, adjacency, queue, tree);
  }
  return tree;
}

function visitGrowthNeighbors(
  current: number,
  adjacency: readonly Neighbor[][],
  queue: number[],
  tree: GrowthTree,
): void {
  for (const neighbor of adjacency[current] ?? []) {
    if ((tree.steps[neighbor.node] ?? -1) >= 0) continue;
    tree.steps[neighbor.node] = (tree.steps[current] ?? 0) + 1;
    tree.parentNodes[neighbor.node] = current;
    tree.parentEdges[neighbor.node] = neighbor.edge;
    queue.push(neighbor.node);
  }
}

function calculateReinforcements(
  adjacency: readonly Neighbor[][],
  resources: readonly number[],
  growthTree: GrowthTree,
): Float32Array {
  const edgeCount = adjacency.reduce((sum, neighbors) => sum + neighbors.length, 0) / 2;
  const traffic = new Float64Array(edgeCount);
  addGrowthTraffic(growthTree, traffic);
  addResourceTraffic({
    adjacency,
    resources,
    traffic,
    routeWeight: adjacency.length / Math.max(1, resources.length * 2),
  });
  return normalizeTraffic(traffic);
}

function addGrowthTraffic(tree: GrowthTree, traffic: Float64Array): void {
  const demand = new Float64Array(tree.steps.length);
  demand.fill(1);
  const descendingNodes = Array.from(tree.steps.keys()).sort(
    (first, second) => (tree.steps[second] ?? 0) - (tree.steps[first] ?? 0),
  );

  for (const node of descendingNodes) {
    const parentNode = tree.parentNodes[node] ?? -1;
    const parentEdge = tree.parentEdges[node] ?? -1;
    if (parentNode < 0 || parentEdge < 0) continue;
    traffic[parentEdge] = (traffic[parentEdge] ?? 0) + (demand[node] ?? 0);
    demand[parentNode] = (demand[parentNode] ?? 0) + (demand[node] ?? 0);
  }
}

function addResourceTraffic(context: Readonly<TrafficContext>): void {
  for (let sourceIndex = 0; sourceIndex < context.resources.length; sourceIndex += 1) {
    const source = context.resources[sourceIndex] ?? 0;
    const parents = createBreadthFirstParents(context.adjacency, source);
    for (let targetIndex = sourceIndex + 1; targetIndex < context.resources.length; targetIndex += 1) {
      addPathTraffic(source, context.resources[targetIndex] ?? source, parents, context);
    }
  }
}

function createBreadthFirstParents(
  adjacency: readonly Neighbor[][],
  source: number,
): { nodes: Int32Array; edges: Int32Array } {
  const nodes = new Int32Array(adjacency.length);
  const edges = new Int32Array(adjacency.length);
  nodes.fill(-1);
  edges.fill(-1);
  nodes[source] = source;
  const queue = [source];

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor] ?? source;
    for (const neighbor of adjacency[current] ?? []) {
      if ((nodes[neighbor.node] ?? -1) >= 0) continue;
      nodes[neighbor.node] = current;
      edges[neighbor.node] = neighbor.edge;
      queue.push(neighbor.node);
    }
  }
  return { nodes, edges };
}

function addPathTraffic(
  source: number,
  target: number,
  parents: { nodes: Int32Array; edges: Int32Array },
  context: Readonly<TrafficContext>,
): void {
  let current = target;
  while (current !== source) {
    const edge = parents.edges[current] ?? -1;
    const parent = parents.nodes[current] ?? -1;
    if (edge < 0 || parent < 0) return;
    context.traffic[edge] = (context.traffic[edge] ?? 0) + context.routeWeight;
    current = parent;
  }
}

function normalizeTraffic(traffic: Float64Array): Float32Array {
  const maximum = traffic.reduce((largest, value) => Math.max(largest, value), 0);
  const denominator = Math.log1p(maximum);
  return Float32Array.from(traffic, (value) =>
    denominator > 0 ? Math.log1p(value) / denominator : 0,
  );
}

function countReinforcedConnections(reinforcements: Float32Array): number {
  let count = 0;
  for (const reinforcement of reinforcements) {
    if (reinforcement >= REINFORCED_THRESHOLD) count += 1;
  }
  return count;
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

function distanceFromOriginSquared(points: Float32Array, point: number): number {
  const offset = point * 3;
  const x = points[offset] ?? 0;
  const y = points[offset + 1] ?? 0;
  const z = points[offset + 2] ?? 0;
  return x * x + y * y + z * z;
}

function distanceSquared(points: Float32Array, first: number, second: number): number {
  const firstOffset = first * 3;
  const secondOffset = second * 3;
  const x = (points[firstOffset] ?? 0) - (points[secondOffset] ?? 0);
  const y = (points[firstOffset + 1] ?? 0) - (points[secondOffset + 1] ?? 0);
  const z = (points[firstOffset + 2] ?? 0) - (points[secondOffset + 2] ?? 0);
  return x * x + y * y + z * z;
}
