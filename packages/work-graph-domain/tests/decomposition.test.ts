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
  it.todo("turns an in-progress item into a parent of newly discovered work");

  it("adds newly discovered work beneath an open item", () => {
    const graph = createWorkGraph({
      workItems: [{ id: "parent", title: "Discovered work" }],
    });
    const decomposed = decomposeWorkItem(graph, {
      parentWorkItemId: "parent",
      children: [
        { id: "first", title: "First child" },
        { id: "second", title: "Second child" },
      ],
    });

    expect(getDirectChildren(decomposed, "parent").map(({ id }) => id)).toEqual([
      "first",
      "second",
    ]);
    expect(projectWorkItemStage(decomposed, "parent")).toBe("blocked");
    expect(getWorkItem(decomposed, "parent").lifecycle).toBe("open");
  });

  it.todo("ends the current lease with a decomposed outcome");

  it("creates children and their dependency edges as one change", () => {
    const graph = createWorkGraph({
      workItems: [{ id: "parent", title: "Parent" }],
    });
    const decomposed = decomposeWorkItem(graph, {
      parentWorkItemId: "parent",
      children: [
        { id: "first", title: "First child" },
        { id: "second", title: "Second child" },
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
          { id: "first", title: "First child" },
          { id: "second", title: "Second child" },
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
        children: [{ id: "child", title: "Child" }],
      }),
    ).toThrowError(
      expect.objectContaining<Partial<WorkGraphError>>({
        code: "terminal_work_item",
      }),
    );
  });

  it.todo("allows the decomposing worker to claim a ready child atomically");
  it.todo("inherits scope and relevant context unless a child overrides them");
  it.todo("preserves the parent's place in the priority order");

  it("allows the parent to become executable again after its children terminate", () => {
    const graph = decomposeWorkItem(
      createWorkGraph({
        workItems: [{ id: "parent", title: "Parent" }],
      }),
      {
        parentWorkItemId: "parent",
        children: [{ id: "child", title: "Child" }],
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
