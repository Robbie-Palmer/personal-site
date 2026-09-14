import { WorkGraphError } from "./errors";
import type {
  WorkGraph,
  WorkGraphInput,
  NewWorkItemInput,
  WorkItem,
  WorkItemDependency,
  WorkItemInput,
} from "./model";
import {
  WORK_ITEM_LIFECYCLES,
  type TerminalWorkItemState,
  type WorkItemLifecycle,
} from "./vocabulary";

const isWorkItemLifecycle = (value: unknown): value is WorkItemLifecycle =>
  WORK_ITEM_LIFECYCLES.some((lifecycle) => lifecycle === value);

const validateWorkItemId = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const validateWorkItemFields = (workItem: WorkItem): void => {
  if (!validateWorkItemId(workItem.id)) {
    throw new WorkGraphError(
      "invalid_work_item_id",
      "A work item ID cannot be empty.",
    );
  }
  if (typeof workItem.title !== "string" || workItem.title.trim().length === 0) {
    throw new WorkGraphError(
      "invalid_work_item_title",
      `Work item ${workItem.id} must have a title.`,
    );
  }
  if (!isWorkItemLifecycle(workItem.lifecycle)) {
    throw new WorkGraphError(
      "invalid_work_item_lifecycle",
      `Work item ${workItem.id} has an invalid lifecycle.`,
    );
  }
  if (workItem.parentId !== null && !validateWorkItemId(workItem.parentId)) {
    throw new WorkGraphError(
      "invalid_parent_id",
      `Work item ${workItem.id} has an invalid parent ID.`,
    );
  }
};

const normalizeWorkItem = (input: WorkItemInput): WorkItem => {
  if (!validateWorkItemId(input.id)) {
    throw new WorkGraphError(
      "invalid_work_item_id",
      "A work item ID cannot be empty.",
    );
  }

  if (typeof input.title !== "string" || input.title.trim().length === 0) {
    throw new WorkGraphError(
      "invalid_work_item_title",
      `Work item ${input.id} must have a title.`,
    );
  }

  const lifecycle = input.lifecycle ?? "open";
  if (!isWorkItemLifecycle(lifecycle)) {
    throw new WorkGraphError(
      "invalid_work_item_lifecycle",
      `Work item ${input.id} has an invalid lifecycle.`,
    );
  }

  const parentId = input.parentId ?? null;
  if (parentId !== null && !validateWorkItemId(parentId)) {
    throw new WorkGraphError(
      "invalid_parent_id",
      `Work item ${input.id} has an invalid parent ID.`,
    );
  }

  return {
    id: input.id,
    title: input.title,
    lifecycle,
    parentId,
  };
};

const indexWorkItems = (workItems: readonly WorkItem[]) => {
  const workItemsById = new Map<string, WorkItem>();

  for (const workItem of workItems) {
    if (workItemsById.has(workItem.id)) {
      throw new WorkGraphError(
        "duplicate_work_item",
        `Work item ${workItem.id} already exists.`,
      );
    }
    workItemsById.set(workItem.id, workItem);
  }

  return workItemsById;
};

const requireWorkItem = (
  workItemsById: ReadonlyMap<string, WorkItem>,
  workItemId: string,
) => {
  const workItem = workItemsById.get(workItemId);
  if (!workItem) {
    throw new WorkGraphError(
      "work_item_not_found",
      `Work item ${workItemId} does not exist.`,
    );
  }
  return workItem;
};

const appendWait = (
  waitsFor: Map<string, Set<string>>,
  waitingWorkItemId: string,
  blockingWorkItemId: string,
) => {
  const blockers = waitsFor.get(waitingWorkItemId) ?? new Set<string>();
  blockers.add(blockingWorkItemId);
  waitsFor.set(waitingWorkItemId, blockers);
};

const findCycle = (graph: WorkGraph): readonly string[] | null => {
  const waitsFor = new Map<string, Set<string>>();
  const childrenByParent = new Map<string, string[]>();

  for (const workItem of graph.workItems) {
    waitsFor.set(workItem.id, new Set());
    childrenByParent.set(workItem.id, []);
  }

  for (const workItem of graph.workItems) {
    if (workItem.parentId !== null) {
      appendWait(waitsFor, workItem.parentId, workItem.id);
      childrenByParent.get(workItem.parentId)?.push(workItem.id);
    }
  }

  for (const dependency of graph.dependencies) {
    const descendants = [dependency.dependentWorkItemId];
    const expanded = new Set<string>();

    while (descendants.length > 0) {
      const dependentWorkItemId = descendants.pop();
      if (!dependentWorkItemId || expanded.has(dependentWorkItemId)) {
        continue;
      }
      expanded.add(dependentWorkItemId);
      appendWait(
        waitsFor,
        dependentWorkItemId,
        dependency.blockerWorkItemId,
      );
      descendants.push(...(childrenByParent.get(dependentWorkItemId) ?? []));
    }
  }

  const visited = new Set<string>();
  const visiting = new Set<string>();

  for (const startingWorkItemId of waitsFor.keys()) {
    if (visited.has(startingWorkItemId)) {
      continue;
    }

    const path = [startingWorkItemId];
    const stack = [
      {
        workItemId: startingWorkItemId,
        blockers: [...(waitsFor.get(startingWorkItemId) ?? [])],
        nextBlockerIndex: 0,
      },
    ];
    visiting.add(startingWorkItemId);

    while (stack.length > 0) {
      const frame = stack.at(-1);
      if (!frame) {
        break;
      }

      if (frame.nextBlockerIndex >= frame.blockers.length) {
        stack.pop();
        path.pop();
        visiting.delete(frame.workItemId);
        visited.add(frame.workItemId);
        continue;
      }

      const blockerId = frame.blockers[frame.nextBlockerIndex];
      frame.nextBlockerIndex += 1;
      if (!blockerId || visited.has(blockerId)) {
        continue;
      }
      if (visiting.has(blockerId)) {
        const cycleStart = path.indexOf(blockerId);
        return [...path.slice(cycleStart), blockerId];
      }

      visiting.add(blockerId);
      path.push(blockerId);
      stack.push({
        workItemId: blockerId,
        blockers: [...(waitsFor.get(blockerId) ?? [])],
        nextBlockerIndex: 0,
      });
    }
  }

  return null;
};

export const validateWorkGraph = (graph: WorkGraph): void => {
  for (const workItem of graph.workItems) {
    validateWorkItemFields(workItem);
  }

  const workItemsById = indexWorkItems(graph.workItems);
  const blockersByDependent = new Map<string, Set<string>>();

  for (const workItem of graph.workItems) {
    if (workItem.parentId !== null) {
      requireWorkItem(workItemsById, workItem.parentId);
    }
  }

  for (const dependency of graph.dependencies) {
    requireWorkItem(workItemsById, dependency.dependentWorkItemId);
    requireWorkItem(workItemsById, dependency.blockerWorkItemId);

    if (dependency.dependentWorkItemId === dependency.blockerWorkItemId) {
      throw new WorkGraphError(
        "self_dependency",
        `Work item ${dependency.dependentWorkItemId} cannot depend on itself.`,
      );
    }

    const blockerIds =
      blockersByDependent.get(dependency.dependentWorkItemId) ??
      new Set<string>();
    if (blockerIds.has(dependency.blockerWorkItemId)) {
      throw new WorkGraphError(
        "dependency_already_exists",
        `Dependency ${dependency.dependentWorkItemId} -> ${dependency.blockerWorkItemId} already exists.`,
      );
    }
    blockerIds.add(dependency.blockerWorkItemId);
    blockersByDependent.set(dependency.dependentWorkItemId, blockerIds);
  }

  const cycle = findCycle(graph);
  if (cycle) {
    throw new WorkGraphError(
      "graph_cycle",
      `The change creates a waits-for cycle: ${cycle.join(" -> ")}.`,
    );
  }
};

export const createWorkGraph = (input: WorkGraphInput = {}): WorkGraph => {
  const graph = {
    workItems: (input.workItems ?? []).map(normalizeWorkItem),
    dependencies: (input.dependencies ?? []).map((dependency) => ({
      ...dependency,
    })),
  } satisfies WorkGraph;
  validateWorkGraph(graph);
  return graph;
};

export const getWorkItem = (
  graph: WorkGraph,
  workItemId: string,
): WorkItem => requireWorkItem(indexWorkItems(graph.workItems), workItemId);

export const addWorkItem = (
  graph: WorkGraph,
  input: NewWorkItemInput,
): WorkGraph => {
  const candidate = {
    ...graph,
    workItems: [...graph.workItems, normalizeWorkItem(input)],
  } satisfies WorkGraph;
  validateWorkGraph(candidate);
  return candidate;
};

export const reparentWorkItem = (
  graph: WorkGraph,
  workItemId: string,
  parentId: string | null,
): WorkGraph => {
  const workItemsById = indexWorkItems(graph.workItems);
  requireWorkItem(workItemsById, workItemId);
  if (parentId !== null) {
    requireWorkItem(workItemsById, parentId);
  }

  const candidate = {
    ...graph,
    workItems: graph.workItems.map((workItem) =>
      workItem.id === workItemId ? { ...workItem, parentId } : workItem,
    ),
  } satisfies WorkGraph;
  validateWorkGraph(candidate);
  return candidate;
};

export const addDependency = (
  graph: WorkGraph,
  dependency: WorkItemDependency,
): WorkGraph => {
  const candidate = {
    ...graph,
    dependencies: [...graph.dependencies, { ...dependency }],
  } satisfies WorkGraph;
  validateWorkGraph(candidate);
  return candidate;
};

export const removeDependency = (
  graph: WorkGraph,
  dependency: WorkItemDependency,
): WorkGraph => {
  const dependencyIndex = graph.dependencies.findIndex(
    (candidate) =>
      candidate.dependentWorkItemId === dependency.dependentWorkItemId &&
      candidate.blockerWorkItemId === dependency.blockerWorkItemId,
  );
  if (dependencyIndex === -1) {
    throw new WorkGraphError(
      "dependency_not_found",
      `Dependency ${dependency.dependentWorkItemId} -> ${dependency.blockerWorkItemId} does not exist.`,
    );
  }

  return {
    ...graph,
    dependencies: graph.dependencies.filter(
      (_candidate, index) => index !== dependencyIndex,
    ),
  };
};

export const getDirectChildren = (
  graph: WorkGraph,
  parentId: string,
): readonly WorkItem[] => {
  getWorkItem(graph, parentId);
  return graph.workItems.filter((workItem) => workItem.parentId === parentId);
};

export const getAncestors = (
  graph: WorkGraph,
  workItemId: string,
): readonly WorkItem[] => {
  const workItemsById = indexWorkItems(graph.workItems);
  const ancestors: WorkItem[] = [];
  let current = requireWorkItem(workItemsById, workItemId);

  while (current.parentId !== null) {
    current = requireWorkItem(workItemsById, current.parentId);
    ancestors.push(current);
  }

  return ancestors;
};

export const getEffectiveDependencies = (
  graph: WorkGraph,
  workItemId: string,
): readonly WorkItemDependency[] => {
  const sourceIds = new Set([
    workItemId,
    ...getAncestors(graph, workItemId).map((ancestor) => ancestor.id),
  ]);
  return graph.dependencies.filter((dependency) =>
    sourceIds.has(dependency.dependentWorkItemId),
  );
};

export const getUnsatisfiedDependencies = (
  graph: WorkGraph,
  workItemId: string,
): readonly WorkItemDependency[] => {
  const workItemsById = indexWorkItems(graph.workItems);
  return getEffectiveDependencies(graph, workItemId).filter(
    (dependency) =>
      requireWorkItem(workItemsById, dependency.blockerWorkItemId).lifecycle ===
      "open",
  );
};

const terminateWorkItem = (
  graph: WorkGraph,
  workItemId: string,
  terminalState: TerminalWorkItemState,
): WorkGraph => {
  const workItem = getWorkItem(graph, workItemId);
  if (workItem.lifecycle !== "open") {
    throw new WorkGraphError(
      "terminal_work_item",
      `Work item ${workItemId} is already ${workItem.lifecycle}.`,
    );
  }

  return {
    ...graph,
    workItems: graph.workItems.map((candidate) =>
      candidate.id === workItemId
        ? { ...candidate, lifecycle: terminalState }
        : candidate,
    ),
  };
};

export const releaseWorkItem = (
  graph: WorkGraph,
  workItemId: string,
): WorkGraph => terminateWorkItem(graph, workItemId, "released");

export const cancelWorkItem = (
  graph: WorkGraph,
  workItemId: string,
): WorkGraph => terminateWorkItem(graph, workItemId, "cancelled");

export interface DecomposeWorkItemInput {
  readonly parentWorkItemId: string;
  readonly children: readonly Omit<NewWorkItemInput, "parentId">[];
  readonly dependencies?: readonly WorkItemDependency[];
}

export const decomposeWorkItem = (
  graph: WorkGraph,
  input: DecomposeWorkItemInput,
): WorkGraph => {
  const parent = getWorkItem(graph, input.parentWorkItemId);
  if (parent.lifecycle !== "open") {
    throw new WorkGraphError(
      "terminal_work_item",
      `Work item ${parent.id} is already ${parent.lifecycle}.`,
    );
  }
  if (input.children.length === 0) {
    throw new WorkGraphError(
      "invalid_decomposition",
      `Work item ${parent.id} cannot be decomposed without children.`,
    );
  }

  const candidate = {
    workItems: [
      ...graph.workItems,
      ...input.children.map((child) =>
        normalizeWorkItem({ ...child, parentId: parent.id }),
      ),
    ],
    dependencies: [
      ...graph.dependencies,
      ...(input.dependencies ?? []).map((dependency) => ({ ...dependency })),
    ],
  } satisfies WorkGraph;
  validateWorkGraph(candidate);
  return candidate;
};
