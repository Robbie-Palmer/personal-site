import {
  createWorkGraph,
  orderWorkItemsByPriority,
  WorkGraphError,
} from "../src/index";
import { priorityFixtures } from "./fixtures/priority";

const orderedIds = (
  input: Parameters<typeof createWorkGraph>[0],
): readonly string[] =>
  orderWorkItemsByPriority(createWorkGraph(input)).map(({ id }) => id);

describe("priority projection", () => {
  it.each(priorityFixtures)("$name", ({ graph, orderedIds: expected }) => {
    expect(orderedIds(graph)).toEqual(expected);
  });

  it("adds ancestor and local weights before comparing hierarchy paths", () => {
    expect(
      orderedIds({
        workItems: [
          { id: "lower-parent", title: "Lower", priorityWeight: 4 },
          {
            id: "boosted-child",
            title: "Boosted child",
            parentId: "lower-parent",
            rank: 2,
            priorityWeight: 7,
          },
          { id: "higher-parent", title: "Higher", priorityWeight: 10 },
          {
            id: "plain-child",
            title: "Plain child",
            parentId: "higher-parent",
            rank: 1,
          },
        ],
      }),
    ).toEqual([
      "boosted-child",
      "higher-parent",
      "plain-child",
      "lower-parent",
    ]);
  });

  it("preserves relative order when a queue is filtered", () => {
    const graph = createWorkGraph(priorityFixtures[1]!.graph);
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

  it("rejects priority weights outside the signed 32-bit range", () => {
    expect(() =>
      createWorkGraph({
        workItems: [
          { id: "work", title: "Work", priorityWeight: 2_147_483_648 },
        ],
      }),
    ).toThrowError(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "invalid_work_item_priority_weight",
      }),
    );
  });
});
