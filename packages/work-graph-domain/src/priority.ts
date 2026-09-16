import { getAncestors, getUnsatisfiedDependencies } from "./graph";
import type { WorkGraph, WorkItem } from "./model";

interface PriorityPathSegment {
  readonly id: string;
  readonly rank: number | null;
}

interface PriorityKey {
  readonly path: readonly PriorityPathSegment[];
  readonly weight: bigint;
}

const compareText = (left: string, right: string): number => {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
};

const comparePathSegment = (
  left: PriorityPathSegment,
  right: PriorityPathSegment,
): number => {
  if (left.rank !== right.rank) {
    if (left.rank === null) return 1;
    if (right.rank === null) return -1;
    return left.rank - right.rank;
  }
  return compareText(left.id, right.id);
};

const comparePriorityKey = (left: PriorityKey, right: PriorityKey): number => {
  if (left.weight !== right.weight) {
    return left.weight > right.weight ? -1 : 1;
  }

  const sharedLength = Math.min(left.path.length, right.path.length);
  for (let index = 0; index < sharedLength; index += 1) {
    const leftSegment = left.path[index];
    const rightSegment = right.path[index];
    if (!leftSegment || !rightSegment) continue;
    const comparison = comparePathSegment(leftSegment, rightSegment);
    if (comparison !== 0) return comparison;
  }
  return left.path.length - right.path.length;
};

const priorityKeyFor = (graph: WorkGraph, item: WorkItem): PriorityKey => {
  const lineage = [...getAncestors(graph, item.id)].reverse();
  lineage.push(item);
  return {
    weight: lineage.reduce(
      (total, ancestor) => total + BigInt(ancestor.priorityWeight),
      0n,
    ),
    path: lineage.map(({ id, rank }) => ({ id, rank })),
  };
};

const dependencyWaits = (graph: WorkGraph): ReadonlyMap<string, string[]> => {
  const waits = new Map<string, string[]>();
  for (const item of graph.workItems) {
    if (item.lifecycle !== "open") continue;
    waits.set(
      item.id,
      getUnsatisfiedDependencies(graph, item.id).map(
        ({ blockerWorkItemId }) => blockerWorkItemId,
      ),
    );
  }
  return waits;
};

const effectivePriorityKeys = (
  graph: WorkGraph,
  baseKeys: ReadonlyMap<string, PriorityKey>,
): ReadonlyMap<string, PriorityKey> => {
  const effectiveKeys = new Map(baseKeys);
  const waits = dependencyWaits(graph);

  for (const waitingItem of graph.workItems) {
    if (waitingItem.lifecycle !== "open") continue;
    const inheritedKey = baseKeys.get(waitingItem.id);
    if (!inheritedKey) continue;

    const pending = [...(waits.get(waitingItem.id) ?? [])];
    const visited = new Set<string>();
    while (pending.length > 0) {
      const blockerId = pending.pop();
      if (!blockerId || visited.has(blockerId)) continue;
      visited.add(blockerId);

      const currentKey = effectiveKeys.get(blockerId);
      if (
        currentKey === undefined ||
        comparePriorityKey(inheritedKey, currentKey) < 0
      ) {
        effectiveKeys.set(blockerId, inheritedKey);
      }
      pending.push(...(waits.get(blockerId) ?? []));
    }
  }
  return effectiveKeys;
};

export const orderWorkItemsByPriority = (
  graph: WorkGraph,
): readonly WorkItem[] => {
  const baseKeys = new Map(
    graph.workItems.map((item) => [item.id, priorityKeyFor(graph, item)]),
  );
  const effectiveKeys = effectivePriorityKeys(graph, baseKeys);

  return [...graph.workItems].sort((left, right) => {
    const effectiveComparison = comparePriorityKey(
      effectiveKeys.get(left.id)!,
      effectiveKeys.get(right.id)!,
    );
    if (effectiveComparison !== 0) return effectiveComparison;

    const baseComparison = comparePriorityKey(
      baseKeys.get(left.id)!,
      baseKeys.get(right.id)!,
    );
    return baseComparison !== 0
      ? baseComparison
      : compareText(left.id, right.id);
  });
};
