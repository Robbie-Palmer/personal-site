describe("attention requests", () => {
  it.todo("ends the requesting worker's lease with an attention-requested outcome");
  it.todo("removes work from the ready queue while blocking attention remains unresolved");
  it.todo(
    "returns work to ready after the last blocking request is resolved and every readiness predicate passes",
  );
  it.todo(
    "keeps work blocked after the last attention request is resolved when another blocker remains",
  );
  it.todo("retains the identity and lease of the previous worker");
  it.todo("allows another worker to claim work after attention is resolved");
  it.todo("records the decision needed without requiring a long handoff report");
  it.todo(
    "prefers the previous worker without delaying higher-priority work indefinitely",
  );
});
