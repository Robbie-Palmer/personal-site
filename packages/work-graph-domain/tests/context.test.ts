import { createWorkGraph } from "../src/index";

describe("work-item context", () => {
  it("accepts a work item with only a title", () => {
    const graph = createWorkGraph({
      workItems: [{ id: "work", title: "Sparse work" }],
    });

    expect(graph.workItems).toEqual([
      {
        id: "work",
        title: "Sparse work",
        lifecycle: "open",
        parentId: null,
      },
    ]);
  });
  it.todo("orders only the available context in a claim response");
  it.todo("presents the nearest parent context before more distant parent context");
  it.todo("keeps initiative and project mirrors separate from executable work");
  it.todo("treats ADRs as governing or background knowledge context");
  it.todo("links one pull request to several work items with explicit roles");
  it.todo("allows several pull requests to provide context for one work item");
  it.todo("does not treat a linked pull request as a dependency edge");
  it.todo("keeps supplemental references free of scheduling semantics");
  it.todo("filters work by semantic fields without arbitrary labels");
});
