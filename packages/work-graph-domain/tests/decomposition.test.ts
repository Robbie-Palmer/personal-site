import {
  createWorkGraph,
  decomposeWorkItem,
  getDirectChildren,
  getWorkItem,
  projectWorkItemStage,
  reparentWorkItem,
  releaseWorkItem,
  WorkGraphError,
} from "../src/index";

describe("decomposition and hierarchy", () => {
  it("adds newly discovered work beneath an open item", () => {
    const graph = createWorkGraph({
      workItems: [{ id: "parent", title: "Discovered work" }],
    });
    const decomposed = decomposeWorkItem(graph, {
      parentWorkItemId: "parent",
      children: [
        { id: "first", title: "First child", rank: 1 },
        { id: "second", title: "Second child", rank: 2 },
      ],
    });

    expect(getDirectChildren(decomposed, "parent").map(({ id }) => id)).toEqual([
      "first",
      "second",
    ]);
    expect(projectWorkItemStage(decomposed, "parent")).toBe("blocked");
    expect(getWorkItem(decomposed, "parent").lifecycle).toBe("open");
  });

  it("creates children and their dependency edges as one change", () => {
    const graph = createWorkGraph({
      workItems: [{ id: "parent", title: "Parent" }],
    });
    const decomposed = decomposeWorkItem(graph, {
      parentWorkItemId: "parent",
      children: [
        { id: "first", title: "First child", rank: 1 },
        { id: "second", title: "Second child", rank: 2 },
      ],
      dependencies: [
        {
          dependentWorkItemId: "second",
          blockerWorkItemId: "first",
        },
      ],
    });

    expect(decomposed.dependencies).toEqual([
      {
        dependentWorkItemId: "second",
        blockerWorkItemId: "first",
      },
    ]);
    expect(projectWorkItemStage(decomposed, "first")).toBe("ready");
    expect(projectWorkItemStage(decomposed, "second")).toBe("blocked");
  });

  it("does not expose a partial child graph when decomposition is invalid", () => {
    const graph = createWorkGraph({
      workItems: [{ id: "parent", title: "Parent" }],
    });

    expect(() =>
      decomposeWorkItem(graph, {
        parentWorkItemId: "parent",
        children: [
          { id: "first", title: "First child", rank: 1 },
          { id: "second", title: "Second child", rank: 2 },
        ],
        dependencies: [
          {
            dependentWorkItemId: "first",
            blockerWorkItemId: "second",
          },
          {
            dependentWorkItemId: "second",
            blockerWorkItemId: "first",
          },
        ],
      }),
    ).toThrowError(
      expect.objectContaining<Partial<WorkGraphError>>({ code: "graph_cycle" }),
    );
    expect(graph.workItems).toHaveLength(1);
    expect(graph.dependencies).toHaveLength(0);
  });

  it("requires an open parent and at least one child", () => {
    const graph = createWorkGraph({
      workItems: [
        { id: "open", title: "Open parent" },
        { id: "released", title: "Released parent", lifecycle: "released" },
      ],
    });

    expect(() =>
      decomposeWorkItem(graph, {
        parentWorkItemId: "open",
        children: [],
      }),
    ).toThrowError(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "invalid_decomposition",
      }),
    );
    expect(() =>
      decomposeWorkItem(graph, {
        parentWorkItemId: "released",
        children: [{ id: "child", title: "Child", rank: 1 }],
      }),
    ).toThrowError(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "work_item_already_terminal",
      }),
    );
  });

  it.todo("allows child context to override inherited context");
  it("orders children by local rank and retains ancestry for inherited context", () => {
    const graph = createWorkGraph({
      workItems: [
        { id: "scope", title: "Inherited project context" },
        { id: "parent", title: "Parent", parentId: "scope" },
      ],
    });
    const decomposed = decomposeWorkItem(graph, {
      parentWorkItemId: "parent",
      children: [
        { id: "later", title: "Later child", rank: 20 },
        { id: "first", title: "First child", rank: 10 },
      ],
    });

    expect(getDirectChildren(decomposed, "parent").map(({ id }) => id)).toEqual([
      "first",
      "later",
    ]);
    expect(getWorkItem(decomposed, "first").parentId).toBe("parent");
    expect(getWorkItem(decomposed, "first").rank).toBe(10);
  });

  it("retains rank across reconstruction and later decomposition", () => {
    const reconstructed = createWorkGraph({
      workItems: [
        { id: "parent", title: "Parent" },
        { id: "later", title: "Later", parentId: "parent", rank: 20 },
      ],
    });
    const extended = decomposeWorkItem(reconstructed, {
      parentWorkItemId: "parent",
      children: [{ id: "first", title: "First", rank: 10 }],
    });

    expect(
      getDirectChildren(extended, "parent").map(({ id, rank }) => ({
        id,
        rank,
      })),
    ).toEqual([
      { id: "first", rank: 10 },
      { id: "later", rank: 20 },
    ]);
    expect(
      reparentWorkItem(extended, "first", "parent").workItems,
    ).toContainEqual(expect.objectContaining({ id: "first", rank: 10 }));
    expect(() =>
      decomposeWorkItem(extended, {
        parentWorkItemId: "parent",
        children: [{ id: "duplicate", title: "Duplicate", rank: 20 }],
      }),
    ).toThrowError(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "invalid_child_rank",
      }),
    );
  });

  it("rejects invalid or duplicate ranks without changing the graph", () => {
    const graph = createWorkGraph({
      workItems: [{ id: "parent", title: "Parent" }],
    });

    for (const ranks of [[0], [1, 1]]) {
      expect(() =>
        decomposeWorkItem(graph, {
          parentWorkItemId: "parent",
          children: ranks.map((rank, index) => ({
            id: `child-${index}`,
            title: `Child ${index}`,
            rank,
          })),
        }),
      ).toThrowError(
        expect.objectContaining<Partial<WorkGraphError>>({
          code: "invalid_child_rank",
        }),
      );
    }
    expect(graph.workItems).toHaveLength(1);
  });

  it("allows the parent to become executable again after its children terminate", () => {
    const graph = decomposeWorkItem(
      createWorkGraph({
        workItems: [{ id: "parent", title: "Parent" }],
      }),
      {
        parentWorkItemId: "parent",
        children: [{ id: "child", title: "Child", rank: 1 }],
      },
    );
    const childReleased = releaseWorkItem(graph, "child");

    expect(projectWorkItemStage(childReleased, "parent")).toBe("ready");
    expect(getWorkItem(childReleased, "parent").lifecycle).toBe("open");
  });

  it.todo("retains identity and history when an item is reparented");

  it("reparents an item without replacing its identity or state", () => {
    const graph = createWorkGraph({
      workItems: [
        { id: "old-parent", title: "Old parent" },
        { id: "new-parent", title: "New parent" },
        { id: "work", title: "Stable work", parentId: "old-parent" },
      ],
    });
    const reparented = reparentWorkItem(graph, "work", "new-parent");

    expect(getWorkItem(reparented, "work")).toEqual({
      id: "work",
      title: "Stable work",
      lifecycle: "open",
      parentId: "new-parent",
      rank: null,
    });
  });

  it("rejects a hierarchy cycle", () => {
    const graph = createWorkGraph({
      workItems: [
        { id: "parent", title: "Parent" },
        { id: "child", title: "Child", parentId: "parent" },
      ],
    });

    expect(() => reparentWorkItem(graph, "parent", "child")).toThrowError(
      expect.objectContaining<Partial<WorkGraphError>>({ code: "graph_cycle" }),
    );
  });
});
