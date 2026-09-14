describe("decomposition and hierarchy", () => {
  it.todo("turns an in-progress item into a parent of newly discovered work");
  it.todo("ends the current lease with a decomposed outcome");
  it.todo("creates children and their dependency edges as one change");
  it.todo("allows the decomposing worker to claim a ready child atomically");
  it.todo("inherits scope and relevant context unless a child overrides them");
  it.todo("preserves the parent's place in the priority order");
  it.todo("allows the parent to become executable again after its children terminate");
  it.todo("retains identity and history when an item is reparented");
  it.todo("rejects a hierarchy cycle");
});
