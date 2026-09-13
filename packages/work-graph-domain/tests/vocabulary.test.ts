import {
  LEASE_OUTCOMES,
  PULL_REQUEST_ROLES,
  WORK_ITEM_LIFECYCLES,
  WORK_STAGES,
} from "../src/index";

describe("work graph vocabulary", () => {
  it("keeps lifecycle states distinct from the derived board stages", () => {
    expect(WORK_ITEM_LIFECYCLES).toEqual(["open", "released", "cancelled"]);
    expect(WORK_STAGES).toEqual([
      "blocked",
      "ready",
      "in_progress",
      "stale",
      "needs_attention",
      "released",
      "cancelled",
    ]);
  });

  it("names the terminal lease outcomes", () => {
    expect(LEASE_OUTCOMES).toEqual([
      "released",
      "cancelled",
      "decomposed",
      "attention_requested",
      "expired",
    ]);
  });

  it("keeps pull request links semantically typed", () => {
    expect(PULL_REQUEST_ROLES).toEqual([
      "implementation",
      "evidence",
      "related",
    ]);
  });
});
