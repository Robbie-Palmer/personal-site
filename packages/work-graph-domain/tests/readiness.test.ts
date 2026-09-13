describe("work-item readiness", () => {
  it.todo("makes an unblocked childless open item ready");
  it.todo("blocks an item with an unsatisfied dependency");
  it.todo("blocks a parent while any direct child remains open");
  it.todo(
    "keeps a parent open and projects it as ready after every direct child terminates",
  );
  it.todo("projects an active lease as in progress");
  it.todo("projects an expired lease as stale and reclaimable");
  it.todo("projects unresolved blocking attention as needs attention");
  it.todo("never makes released or cancelled work claimable");
  it.todo("inherits unresolved dependencies from ancestor work items");
});
