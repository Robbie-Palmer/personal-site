import type { FlowSankeyData, FlowSankeyNode } from "@/lib/domain/assettracker";

export const FLOW_SANKEY_NODE_WIDTH = 12;
export const FLOW_SANKEY_LINK_COLOR = "hsl(220, 70%, 50%)";

const COMPACT_NODE_PADDING = 14;
const LABELED_NODE_PADDING = 18;
const COMPACT_BASE_HEIGHT = 280;
const LABELED_BASE_HEIGHT = 320;
const MIN_NODE_HEIGHT = 2;
const LABEL_GAP = 8;
const MIN_LABEL_WIDTH = 48;
const MAX_LABEL_WIDTH = 136;
const MIN_LABELED_WIDTH = 640;

const COMPACT_MARGIN = { top: 8, right: 12, bottom: 8, left: 12 };
const LABELED_MARGIN = { top: 8, right: 140, bottom: 8, left: 120 };

export type FlowSankeyLayout = {
  chartHeight: number;
  labelWidths: {
    left: number;
    middle: number;
    right: number;
  };
  margin: typeof COMPACT_MARGIN;
  maxDepth: number;
  nodePadding: number;
  showLabels: boolean;
};

export type FlowSankeyRenderNode = FlowSankeyNode & {
  flowKey?: string;
  isWaypoint?: boolean;
};

export type FlowSankeyRenderLink = FlowSankeyData["links"][number] & {
  flowKey: string;
};

export type FlowSankeyRenderData = Omit<FlowSankeyData, "links" | "nodes"> & {
  nodes: FlowSankeyRenderNode[];
  links: FlowSankeyRenderLink[];
};

function nodeDepths(data: FlowSankeyData): number[] {
  const depths = data.nodes.map(() => 0);

  // Sankey data is normally acyclic. Bounding the relaxation by the number of
  // nodes also gives a stable fallback for malformed, cyclic imported data.
  for (const _node of data.nodes) {
    let changed = false;
    for (const link of data.links) {
      const sourceDepth = depths[link.source];
      const targetDepth = depths[link.target];
      if (sourceDepth == null || targetDepth == null) continue;
      const nextDepth = Math.min(data.nodes.length - 1, sourceDepth + 1);
      if (nextDepth > targetDepth) {
        depths[link.target] = nextDepth;
        changed = true;
      }
    }
    if (!changed) break;
  }

  return depths;
}

export function addFlowSankeyWaypoints(
  data: FlowSankeyData,
): FlowSankeyRenderData {
  const depths = nodeDepths(data);
  const nodes: FlowSankeyRenderNode[] = [...data.nodes];
  const links = data.links.flatMap((link, linkIndex) => {
    const flowKey = `flow:${linkIndex}`;
    const sourceDepth = depths[link.source] ?? 0;
    const targetDepth = depths[link.target] ?? sourceDepth + 1;
    const segments = [];
    let source = link.source;

    for (let depth = sourceDepth + 1; depth < targetDepth; depth += 1) {
      const target = nodes.length;
      nodes.push({
        id: `__flow_waypoint:${linkIndex}:${depth}`,
        name: "",
        color: FLOW_SANKEY_LINK_COLOR,
        flowKey,
        isWaypoint: true,
      });
      segments.push({ ...link, flowKey, source, target });
      source = target;
    }

    segments.push({ ...link, flowKey, source, target: link.target });
    return segments;
  });

  return { nodes, links };
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

function reorderLayer(
  layer: number[],
  positions: Map<number, number>,
  neighbours: Map<number, Array<{ index: number; value: number }>>,
) {
  const previousOrder = new Map(
    layer.map((nodeIndex, position) => [nodeIndex, position]),
  );
  const barycentre = (nodeIndex: number) => {
    const adjacent = neighbours.get(nodeIndex) ?? [];
    if (adjacent.length === 0) return previousOrder.get(nodeIndex) ?? 0;
    const totalWeight = adjacent.reduce((sum, edge) => sum + edge.value, 0);
    if (totalWeight === 0) return previousOrder.get(nodeIndex) ?? 0;
    return (
      adjacent.reduce(
        (sum, edge) => sum + (positions.get(edge.index) ?? 0) * edge.value,
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

function crossingWeight(data: FlowSankeyRenderData, layers: number[][]) {
  const positions = nodePositions(layers);
  const depths = new Map(
    layers.flatMap((layer, depth) =>
      layer.map((nodeIndex) => [nodeIndex, depth] as const),
    ),
  );
  let weight = 0;

  for (const [left, first] of data.links.entries()) {
    for (const second of data.links.slice(left + 1)) {
      weight += linkPairCrossingWeight(first, second, positions, depths);
    }
  }

  return weight;
}

function linkPairCrossingWeight(
  first: FlowSankeyRenderLink,
  second: FlowSankeyRenderLink,
  positions: Map<number, number>,
  depths: Map<number, number>,
) {
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
    ? Math.sqrt(first.value * second.value)
    : 0;
}

function transposeLayer(data: FlowSankeyRenderData, layers: number[][]) {
  let changed = false;
  for (const layer of layers) {
    for (let position = 0; position < layer.length - 1; position += 1) {
      const before = crossingWeight(data, layers);
      const nextPosition = position + 1;
      const current = layer[position];
      const next = layer[nextPosition];
      if (current == null || next == null) continue;
      layer[position] = next;
      layer[nextPosition] = current;
      if (crossingWeight(data, layers) < before) {
        changed = true;
      } else {
        layer[position] = current;
        layer[nextPosition] = next;
      }
    }
  }
  return changed;
}

function transposeLayers(data: FlowSankeyRenderData, layers: number[][]) {
  for (const _layer of layers) {
    if (!transposeLayer(data, layers)) break;
  }
}

type NeighbourMaps = {
  incoming: Map<number, Array<{ index: number; value: number }>>;
  outgoing: Map<number, Array<{ index: number; value: number }>>;
};

function neighbourMaps(data: FlowSankeyRenderData): NeighbourMaps {
  const incoming: NeighbourMaps["incoming"] = new Map();
  const outgoing: NeighbourMaps["outgoing"] = new Map();
  for (const link of data.links) {
    incoming.set(link.target, [
      ...(incoming.get(link.target) ?? []),
      { index: link.source, value: link.value },
    ]);
    outgoing.set(link.source, [
      ...(outgoing.get(link.source) ?? []),
      { index: link.target, value: link.value },
    ]);
  }
  return { incoming, outgoing };
}

function reorderLayers(
  data: FlowSankeyRenderData,
  layers: number[][],
  { incoming, outgoing }: NeighbourMaps,
) {
  for (const layer of layers.slice(1)) {
    reorderLayer(layer, nodePositions(layers), incoming);
  }
  for (const layer of layers.slice(0, -1).reverse()) {
    reorderLayer(layer, nodePositions(layers), outgoing);
  }
  transposeLayers(data, layers);
}

export function minimizeFlowSankeyCrossings(
  data: FlowSankeyRenderData,
): FlowSankeyRenderData {
  const depths = nodeDepths(data);
  const maxDepth = Math.max(0, ...depths);
  const layers = Array.from({ length: maxDepth + 1 }, () => [] as number[]);
  for (const [nodeIndex, depth] of depths.entries()) {
    layers[depth]?.push(nodeIndex);
  }
  transposeLayers(data, layers);
  let bestLayers = cloneLayers(layers);
  let bestWeight = crossingWeight(data, layers);
  const neighbours = neighbourMaps(data);

  for (let pass = 0; pass < 8 && bestWeight > 0; pass += 1) {
    reorderLayers(data, layers, neighbours);
    const weight = crossingWeight(data, layers);
    if (weight < bestWeight) {
      bestWeight = weight;
      bestLayers = cloneLayers(layers);
    }
  }

  const orderedNodeIndexes = bestLayers.flat();
  const remappedIndexes = new Map(
    orderedNodeIndexes.map((nodeIndex, nextIndex) => [nodeIndex, nextIndex]),
  );
  return {
    nodes: orderedNodeIndexes.flatMap((nodeIndex) => {
      const node = data.nodes[nodeIndex];
      return node ? [node] : [];
    }),
    links: data.links.map((link) => ({
      ...link,
      source: remappedIndexes.get(link.source) ?? link.source,
      target: remappedIndexes.get(link.target) ?? link.target,
    })),
  };
}

export function prepareFlowSankeyData(
  data: FlowSankeyData,
): FlowSankeyRenderData {
  return minimizeFlowSankeyCrossings(addFlowSankeyWaypoints(data));
}

export function flowKeysForNode(
  data: FlowSankeyRenderData,
  nodeIndex: number,
): Set<string> {
  return new Set(
    data.links.flatMap((link) =>
      link.source === nodeIndex || link.target === nodeIndex
        ? [link.flowKey]
        : [],
    ),
  );
}

export function getFlowSankeyLayout(
  data: FlowSankeyData,
  containerWidth: number,
): FlowSankeyLayout {
  const depths = nodeDepths(data);
  const maxDepth = Math.max(0, ...depths);
  const labeledPlotWidth =
    containerWidth - LABELED_MARGIN.left - LABELED_MARGIN.right;
  const columnGap =
    maxDepth === 0
      ? labeledPlotWidth
      : (labeledPlotWidth - FLOW_SANKEY_NODE_WIDTH) / maxDepth;
  const middleLabelWidth = Math.min(
    MAX_LABEL_WIDTH,
    Math.max(0, columnGap - FLOW_SANKEY_NODE_WIDTH - LABEL_GAP * 2),
  );
  const showLabels =
    containerWidth >= MIN_LABELED_WIDTH &&
    (maxDepth <= 1 || middleLabelWidth >= MIN_LABEL_WIDTH);
  const margin = showLabels ? LABELED_MARGIN : COMPACT_MARGIN;
  const nodePadding = showLabels ? LABELED_NODE_PADDING : COMPACT_NODE_PADDING;
  const nodesPerDepth = new Map<number, number>();
  for (const depth of depths) {
    nodesPerDepth.set(depth, (nodesPerDepth.get(depth) ?? 0) + 1);
  }
  const busiestDepth = Math.max(1, ...nodesPerDepth.values());
  const minimumInnerHeight =
    (busiestDepth - 1) * nodePadding + busiestDepth * MIN_NODE_HEIGHT;
  const baseHeight = showLabels ? LABELED_BASE_HEIGHT : COMPACT_BASE_HEIGHT;

  return {
    chartHeight: Math.max(
      baseHeight,
      minimumInnerHeight + margin.top + margin.bottom,
    ),
    labelWidths: {
      left: LABELED_MARGIN.left - LABEL_GAP * 2,
      middle: middleLabelWidth,
      right: LABELED_MARGIN.right - LABEL_GAP * 2,
    },
    margin,
    maxDepth,
    nodePadding,
    showLabels,
  };
}
