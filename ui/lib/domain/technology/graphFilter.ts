import type { GraphData, GraphNode } from "@/lib/api/graph-data";

export interface FilteredGraphData {
  nodes: (GraphNode & {
    connections: number;
    totalConnections?: number;
  })[];
  edges: { source: string; target: string; type: string }[];
}

type GraphEdge = GraphData["edges"][number];
type Neighbor = GraphEdge & { target: string; direction: "in" | "out" };

function addUniqueEdge(
  edges: GraphEdge[],
  edgeKeys: Set<string>,
  source: string,
  target: string,
  type: string,
): void {
  if (source === target) return;
  const key = source < target ? `${source}|${target}` : `${target}|${source}`;
  if (edgeKeys.has(key)) return;
  edgeKeys.add(key);
  edges.push({ source, target, type });
}

function buildNeighbors(edges: GraphEdge[]): Map<string, Neighbor[]> {
  const neighbors = new Map<string, Neighbor[]>();
  for (const edge of edges) {
    const sourceNeighbors = neighbors.get(edge.source) ?? [];
    sourceNeighbors.push({ ...edge, target: edge.target, direction: "out" });
    neighbors.set(edge.source, sourceNeighbors);

    const targetNeighbors = neighbors.get(edge.target) ?? [];
    targetNeighbors.push({ ...edge, target: edge.source, direction: "in" });
    neighbors.set(edge.target, targetNeighbors);
  }
  return neighbors;
}

function canTraverse(edge: Neighbor): boolean {
  if (edge.type === "HAS_TAG") return false;
  if (edge.direction === "in") return true;
  return !["PART_OF_PROJECT", "CREATED_AT_ROLE", "WRITTEN_AT_ROLE"].includes(
    edge.type,
  );
}

function findReachableTechnologies(
  startId: string,
  neighbors: ReadonlyMap<string, Neighbor[]>,
  hiddenNodeIds: ReadonlySet<string>,
  visibleNodeIds: ReadonlySet<string>,
): Set<string> {
  const technologies = new Set<string>();
  const visited = new Set([startId]);
  const queue = [startId];
  let current = queue.shift();

  while (current !== undefined) {
    for (const edge of neighbors.get(current) ?? []) {
      if (visited.has(edge.target) || !canTraverse(edge)) continue;
      visited.add(edge.target);
      if (
        edge.target.startsWith("technology:") &&
        visibleNodeIds.has(edge.target)
      ) {
        technologies.add(edge.target);
      } else if (hiddenNodeIds.has(edge.target)) {
        queue.push(edge.target);
      }
    }
    current = queue.shift();
  }
  return technologies;
}

function addTransitiveTechnologyEdges(
  data: GraphData,
  visibleNodes: GraphNode[],
  visibleNodeIds: ReadonlySet<string>,
  hiddenNodeIds: ReadonlySet<string>,
  edges: GraphEdge[],
  edgeKeys: Set<string>,
): void {
  const neighbors = buildNeighbors(data.edges);
  for (const node of visibleNodes) {
    if (node.id.startsWith("technology:")) continue;
    const technologies = findReachableTechnologies(
      node.id,
      neighbors,
      hiddenNodeIds,
      visibleNodeIds,
    );
    for (const technologyId of technologies) {
      addUniqueEdge(edges, edgeKeys, node.id, technologyId, "USES_TECHNOLOGY");
    }
  }
}

function countConnections(edges: GraphEdge[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const edge of edges) {
    counts.set(edge.source, (counts.get(edge.source) ?? 0) + 1);
    counts.set(edge.target, (counts.get(edge.target) ?? 0) + 1);
  }
  return counts;
}

export function filterGraphData(
  data: GraphData,
  hiddenTypes: ReadonlySet<string>,
  minConnections: number,
): FilteredGraphData {
  const visibleNodes = data.nodes.filter(
    (node) => hiddenTypes.size === 0 || !hiddenTypes.has(node.type),
  );
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
  const hiddenNodeIds = new Set(
    data.nodes
      .filter((node) => !visibleNodeIds.has(node.id))
      .map((node) => node.id),
  );
  const edgeKeys = new Set<string>();
  const edges: GraphEdge[] = [];
  for (const edge of data.edges) {
    if (visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)) {
      addUniqueEdge(edges, edgeKeys, edge.source, edge.target, edge.type);
    }
  }
  if (hiddenNodeIds.size > 0 && !hiddenTypes.has("technology")) {
    addTransitiveTechnologyEdges(
      data,
      visibleNodes,
      visibleNodeIds,
      hiddenNodeIds,
      edges,
      edgeKeys,
    );
  }

  const connectionCounts = countConnections(edges);
  const finalNodeIds = new Set(
    visibleNodes
      .filter((node) => (connectionCounts.get(node.id) ?? 0) >= minConnections)
      .map((node) => node.id),
  );
  return {
    nodes: visibleNodes
      .filter((node) => finalNodeIds.has(node.id))
      .map((node) => ({
        ...node,
        connections: connectionCounts.get(node.id) ?? 0,
        totalConnections: node.connections,
      })),
    edges: edges.filter(
      (edge) => finalNodeIds.has(edge.source) && finalNodeIds.has(edge.target),
    ),
  };
}
