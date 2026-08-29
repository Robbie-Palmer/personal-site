import type { GraphNode } from "@/lib/api/graph-data";

const NODE_TYPE_ORDER = [
  "project",
  "blog",
  "role",
  "adr",
  "technology",
  "tag",
] as const;
const GOLDEN_ANGLE = 2.399963;

function compareNodeTypes(left: string, right: string): number {
  const leftIndex = NODE_TYPE_ORDER.indexOf(
    left as (typeof NODE_TYPE_ORDER)[number],
  );
  const rightIndex = NODE_TYPE_ORDER.indexOf(
    right as (typeof NODE_TYPE_ORDER)[number],
  );
  if (leftIndex < 0 && rightIndex < 0) return left.localeCompare(right);
  if (leftIndex < 0) return 1;
  if (rightIndex < 0) return -1;
  return leftIndex - rightIndex;
}

export function calculateGraphLayout(
  nodes: readonly GraphNode[],
  visibleNodeIds: ReadonlySet<string>,
): Float32Array {
  const positions = new Float32Array(nodes.length * 2);
  positions.fill(Number.NaN);

  const visibleNodes = nodes
    .map((node, index) => ({ index, node }))
    .filter(({ node }) => visibleNodeIds.has(node.id));
  if (visibleNodes.length === 0) return positions;

  const visibleTypes = [
    ...new Set(visibleNodes.map(({ node }) => node.type)),
  ].sort(compareNodeTypes);
  const typeIndex = new Map(visibleTypes.map((type, index) => [type, index]));
  const typeAngle = (Math.PI * 2) / visibleTypes.length;

  let centerX = 0;
  let centerY = 0;
  for (const [visibleIndex, { index, node }] of visibleNodes.entries()) {
    const angle =
      (typeIndex.get(node.type) ?? 0) * typeAngle + visibleIndex * GOLDEN_ANGLE;
    const radius = 160 + (visibleIndex % 11) * 19;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    positions[index * 2] = x;
    positions[index * 2 + 1] = y;
    centerX += x;
    centerY += y;
  }

  centerX /= visibleNodes.length;
  centerY /= visibleNodes.length;
  for (const { index } of visibleNodes) {
    positions[index * 2] = (positions[index * 2] ?? 0) - centerX;
    positions[index * 2 + 1] = (positions[index * 2 + 1] ?? 0) - centerY;
  }

  return positions;
}
