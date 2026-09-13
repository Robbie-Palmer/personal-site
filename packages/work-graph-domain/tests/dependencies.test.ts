describe("work-item dependencies", () => {
  it.todo("makes released blocker work satisfy its downstream dependencies");
  it.todo("makes cancelled blocker work satisfy its downstream dependencies");
  it.todo("requires replacement work to be added as a new blocker");
  it.todo("does not redirect dependencies when blocker work is cancelled");
  it.todo("rejects a direct dependency cycle");
  it.todo("rejects a transitive dependency cycle");
  it.todo("rejects a child depending on its own parent");
  it.todo("rejects reparenting that would create a combined waits-for cycle");
  it.todo("keeps hierarchy and dependency relationships semantically separate");
});
