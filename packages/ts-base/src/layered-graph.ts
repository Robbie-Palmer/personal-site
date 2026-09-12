export type LayeredGraphEdge = Readonly<{
  source: number;
  target: number;
  weight: number;
}>;

export type LayeredGraphOrderOptions = Readonly<{
  maxBarycentricPasses?: number;
  maxExactCrossingEdges?: number;
}>;

const DEFAULT_MAX_BARYCENTRIC_PASSES = 8;
const DEFAULT_MAX_EXACT_CROSSING_EDGES = 96;

function assertNodeCount(nodeCount: number): void {
  if (!Number.isInteger(nodeCount) || nodeCount < 0) {
    throw new RangeError("nodeCount must be a non-negative integer");
  }
}

function validEdges(
  nodeCount: number,
  edges: readonly LayeredGraphEdge[],
): LayeredGraphEdge[] {
  return edges.filter(
    ({ source, target, weight }) =>
      Number.isInteger(source) &&
      Number.isInteger(target) &&
      source >= 0 &&
      target >= 0 &&
      source < nodeCount &&
      target < nodeCount &&
      Number.isFinite(weight) &&
      weight >= 0,
  );
}

export function layeredGraphNodeDepths(
  nodeCount: number,
  edges: readonly LayeredGraphEdge[],
): number[] {
  assertNodeCount(nodeCount);
  const depths = Array.from({ length: nodeCount }, () => 0);
  const graphEdges = validEdges(nodeCount, edges);

  // Layered graphs are normally acyclic. Bounding the relaxation by the node
  // count also gives a stable fallback for malformed cyclic input.
  for (let pass = 0; pass < nodeCount; pass += 1) {
    let changed = false;
    for (const edge of graphEdges) {
      const sourceDepth = depths[edge.source];
      const targetDepth = depths[edge.target];
      if (sourceDepth == null || targetDepth == null) continue;
      const nextDepth = Math.min(nodeCount - 1, sourceDepth + 1);
      if (nextDepth > targetDepth) {
        depths[edge.target] = nextDepth;
        changed = true;
      }
    }
    if (!changed) break;
  }

  return depths;
}

function cloneLayers(layers: number[][]): number[][] {
  return layers.map((layer) => [...layer]);
}

function nodePositions(layers: number[][]): Map<number, number> {
  return new Map(
    layers.flatMap((layer) =>
      layer.map((nodeIndex, position) => [nodeIndex, position] as const),
    ),
  );
}

type WeightedNeighbour = { index: number; weight: number };

function reorderLayer(
  layer: number[],
  positions: Map<number, number>,
  neighbours: Map<number, WeightedNeighbour[]>,
): void {
  const previousOrder = new Map(
    layer.map((nodeIndex, position) => [nodeIndex, position]),
  );
  const barycentre = (nodeIndex: number) => {
    const adjacent = neighbours.get(nodeIndex) ?? [];
    if (adjacent.length === 0) return previousOrder.get(nodeIndex) ?? 0;
    const totalWeight = adjacent.reduce((sum, edge) => sum + edge.weight, 0);
    if (totalWeight === 0) return previousOrder.get(nodeIndex) ?? 0;
    return (
      adjacent.reduce(
        (sum, edge) => sum + (positions.get(edge.index) ?? 0) * edge.weight,
        0,
      ) / totalWeight
    );
  };

  layer.sort(
    (left, right) =>
      barycentre(left) - barycentre(right) ||
      (previousOrder.get(left) ?? 0) - (previousOrder.get(right) ?? 0),
  );
}

function linkPairCrossingWeight(
  first: LayeredGraphEdge,
  second: LayeredGraphEdge,
  positions: Map<number, number>,
  depths: Map<number, number>,
): number {
  const spansDifferentLayers =
    depths.get(first.source) !== depths.get(second.source) ||
    depths.get(first.target) !== depths.get(second.target);
  const sharesNode =
    first.source === second.source || first.target === second.target;
  if (spansDifferentLayers || sharesNode) return 0;

  const sourceOrder =
    (positions.get(first.source) ?? 0) - (positions.get(second.source) ?? 0);
  const targetOrder =
    (positions.get(first.target) ?? 0) - (positions.get(second.target) ?? 0);
  return sourceOrder * targetOrder < 0
    ? Math.sqrt(first.weight * second.weight)
    : 0;
}

function crossingWeight(edges: LayeredGraphEdge[], layers: number[][]): number {
  const positions = nodePositions(layers);
  const depths = new Map(
    layers.flatMap((layer, depth) =>
      layer.map((nodeIndex) => [nodeIndex, depth] as const),
    ),
  );
  let weight = 0;

  for (const [left, first] of edges.entries()) {
    for (const second of edges.slice(left + 1)) {
      weight += linkPairCrossingWeight(first, second, positions, depths);
    }
  }

  return weight;
}

function transposeLayer(edges: LayeredGraphEdge[], layers: number[][]): boolean {
  let changed = false;
  for (const layer of layers) {
    for (let position = 0; position < layer.length - 1; position += 1) {
      const before = crossingWeight(edges, layers);
      const nextPosition = position + 1;
      const current = layer[position];
      const next = layer[nextPosition];
      if (current == null || next == null) continue;
      layer[position] = next;
      layer[nextPosition] = current;
      if (crossingWeight(edges, layers) < before) {
        changed = true;
      } else {
        layer[position] = current;
        layer[nextPosition] = next;
      }
    }
  }
  return changed;
}

function transposeLayers(edges: LayeredGraphEdge[], layers: number[][]): void {
  for (const _layer of layers) {
    if (!transposeLayer(edges, layers)) break;
  }
}

type NeighbourMaps = {
  incoming: Map<number, WeightedNeighbour[]>;
  outgoing: Map<number, WeightedNeighbour[]>;
};

function neighbourMaps(edges: LayeredGraphEdge[]): NeighbourMaps {
  const incoming: NeighbourMaps["incoming"] = new Map();
  const outgoing: NeighbourMaps["outgoing"] = new Map();
  for (const edge of edges) {
    incoming.set(edge.target, [
      ...(incoming.get(edge.target) ?? []),
      { index: edge.source, weight: edge.weight },
    ]);
    outgoing.set(edge.source, [
      ...(outgoing.get(edge.source) ?? []),
      { index: edge.target, weight: edge.weight },
    ]);
  }
  return { incoming, outgoing };
}

function reorderLayers(
  edges: LayeredGraphEdge[],
  layers: number[][],
  { incoming, outgoing }: NeighbourMaps,
  transpose: boolean,
): void {
  for (const layer of layers.slice(1)) {
    reorderLayer(layer, nodePositions(layers), incoming);
  }
  for (const layer of layers.slice(0, -1).reverse()) {
    reorderLayer(layer, nodePositions(layers), outgoing);
  }
  if (transpose) transposeLayers(edges, layers);
}

function nonNegativeInteger(value: number | undefined, fallback: number): number {
  if (value == null) return fallback;
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : fallback;
}

export function orderLayeredGraphNodes(
  nodeCount: number,
  edges: readonly LayeredGraphEdge[],
  options: LayeredGraphOrderOptions = {},
): number[] {
  assertNodeCount(nodeCount);
  const graphEdges = validEdges(nodeCount, edges);
  const depths = layeredGraphNodeDepths(nodeCount, graphEdges);
  const maxDepth = Math.max(0, ...depths);
  const layers = Array.from({ length: maxDepth + 1 }, () => [] as number[]);
  for (const [nodeIndex, depth] of depths.entries()) {
    layers[depth]?.push(nodeIndex);
  }

  const maxBarycentricPasses = nonNegativeInteger(
    options.maxBarycentricPasses,
    DEFAULT_MAX_BARYCENTRIC_PASSES,
  );
  const maxExactCrossingEdges = nonNegativeInteger(
    options.maxExactCrossingEdges,
    DEFAULT_MAX_EXACT_CROSSING_EDGES,
  );
  const neighbours = neighbourMaps(graphEdges);

  if (graphEdges.length > maxExactCrossingEdges) {
    for (let pass = 0; pass < maxBarycentricPasses; pass += 1) {
      const previousOrder = layers.flat().join(",");
      reorderLayers(graphEdges, layers, neighbours, false);
      if (layers.flat().join(",") === previousOrder) break;
    }
    return layers.flat();
  }

  transposeLayers(graphEdges, layers);
  let bestLayers = cloneLayers(layers);
  let bestWeight = crossingWeight(graphEdges, layers);

  for (
    let pass = 0;
    pass < maxBarycentricPasses && bestWeight > 0;
    pass += 1
  ) {
    reorderLayers(graphEdges, layers, neighbours, true);
    const weight = crossingWeight(graphEdges, layers);
    if (weight < bestWeight) {
      bestWeight = weight;
      bestLayers = cloneLayers(layers);
    }
  }

  return bestLayers.flat();
}
