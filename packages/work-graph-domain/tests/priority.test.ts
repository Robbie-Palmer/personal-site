describe("priority projection", () => {
  it.todo("includes ancestor priority when ordering descendant work");
  it.todo("respects explicit local rank between siblings");
  it.todo("propagates blocked descendant urgency backwards to its blockers");
  it.todo("uses the highest inherited urgency when one item blocks several branches");
  it.todo("produces a deterministic total order when priority inputs tie");
  it.todo("preserves relative order when the queue is filtered by scope");
  it.todo("orders newly decomposed work within its former parent's position");
});
