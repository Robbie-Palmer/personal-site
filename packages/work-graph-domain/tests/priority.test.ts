import {
  createKnowledgeScope,
  createWorkGraph,
  orderWorkItemsByPriority,
  projectWorkItemPriority,
  WorkGraphError,
} from "../src/index";
import { priorityFixtures } from "./fixtures/priority";

const orderedIds = (
  fixture: (typeof priorityFixtures)[number],
): readonly string[] => {
  const graph = createWorkGraph(fixture.graph);
  const scopes = (fixture.scopes ?? []).map(createKnowledgeScope);
  return orderWorkItemsByPriority(graph, scopes).map(({ id }) => id);
};

describe("priority projection", () => {
  it.each(priorityFixtures)("$name", (fixture) => {
    expect(orderedIds(fixture)).toEqual(fixture.orderedIds);
  });

  it("inherits one ticket priority through decomposition without rewarding depth", () => {
    const graph = createWorkGraph({
      workItems: [
        { id: "ticket", title: "Ticket", priorityRank: 1_024 },
        { id: "child", title: "Child", parentId: "ticket", rank: 2 },
        { id: "grandchild", title: "Grandchild", parentId: "child", rank: 1 },
        { id: "other", title: "Other", priorityRank: 2_048 },
      ],
    });

    expect(projectWorkItemPriority(graph, "ticket").ticketRank).toBe(1);
    expect(projectWorkItemPriority(graph, "child").ticketRank).toBe(1);
    expect(projectWorkItemPriority(graph, "grandchild").ticketRank).toBe(1);
    expect(projectWorkItemPriority(graph, "other").ticketRank).toBe(2);
  });

  it("preserves relative order when a queue is filtered", () => {
    const fixture = priorityFixtures[1]!;
    const graph = createWorkGraph(fixture.graph);
    const includedIds = new Set(["database", "release-ui", "chores"]);
    const filtered = orderWorkItemsByPriority(graph).filter(({ id }) =>
      includedIds.has(id),
    );

    expect(filtered.map(({ id }) => id)).toEqual([
      "database",
      "release-ui",
      "chores",
    ]);
  });

  it("does not reorder existing work when a ticket is added at the bottom", () => {
    const existing = createWorkGraph({
      workItems: [
        { id: "first", title: "First", priorityRank: 1_024 },
        { id: "second", title: "Second", priorityRank: 2_048 },
        { id: "third", title: "Third", priorityRank: 3_072 },
      ],
    });
    const withBacklog = createWorkGraph({
      workItems: [
        ...existing.workItems,
        { id: "backlog", title: "Backlog", priorityRank: 4_096 },
      ],
    });

    expect(orderWorkItemsByPriority(existing).map(({ id }) => id)).toEqual([
      "first",
      "second",
      "third",
    ]);
    expect(orderWorkItemsByPriority(withBacklog).map(({ id }) => id)).toEqual([
      "first",
      "second",
      "third",
      "backlog",
    ]);
  });

  it("reports donated urgency without changing stored expedite state", () => {
    const graph = createWorkGraph(priorityFixtures[2]!.graph);

    expect(projectWorkItemPriority(graph, "shared")).toMatchObject({
      donatedFromWorkItemId: "urgent",
      effectiveExpedited: true,
      expedited: false,
    });
  });

  it("rejects invalid priority ranks and inconsistent expedite state", () => {
    expect(() =>
      createWorkGraph({
        workItems: [{ id: "work", title: "Work", priorityRank: 0 }],
      }),
    ).toThrowError(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "invalid_priority_rank",
      }),
    );

    expect(() =>
      createWorkGraph({
        workItems: [{ id: "work", title: "Work", expedited: true }],
      }),
    ).toThrowError(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "invalid_expedite_reason",
      }),
    );

    expect(() =>
      createWorkGraph({
        workItems: [
          { id: "ticket", title: "Ticket", priorityRank: 1_024 },
          {
            id: "child",
            title: "Child",
            parentId: "ticket",
            schedulingProjectId: "project",
          },
        ],
      }),
    ).toThrowError(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "invalid_scheduling_scope",
      }),
    );
  });
});
