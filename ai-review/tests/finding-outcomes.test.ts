import { describe, expect, it } from "vitest";
import {
  buildFindingOutcomeRecord,
  classifyFinalizedFinding,
} from "../src/finding-outcomes";

describe("finding outcomes", () => {
  it.each([
    ["acknowledged", "open", "a", "a", false, true, "acknowledged"],
    ["rejected", "open", "a", "a", false, true, "rejected"],
    [null, "resolved", "a", "b", true, true, "confirmed-fixed"],
    [null, "open", "a", "a", true, false, "superseded"],
    [null, "open", "a", "a", true, true, "no-observable-response"],
    [null, "open", "a", "a", false, false, "no-observable-response"],
  ])(
    "classifies disposition=%s status=%s final coverage=%s",
    (
      disposition,
      status,
      firstSeenHeadSha,
      lastSeenHeadSha,
      finalHeadWasReviewed,
      affectedCodeRemains,
      expected,
    ) => {
      expect(
        classifyFinalizedFinding({
          disposition,
          status,
          firstSeenHeadSha,
          lastSeenHeadSha,
          finalHeadWasReviewed,
          affectedCodeRemains,
        }),
      ).toBe(expected);
    },
  );

  it("builds a portable versioned record", () => {
    expect(
      buildFindingOutcomeRecord({
        repository: "owner/repository",
        pullRequestNumber: 42,
        findingId: `f_${"a".repeat(24)}`,
        outcome: "confirmed-fixed",
        basis: "later-reviewed-head",
        sourceId: "review:run:finding",
        outcomeVersion: 2,
        occurredAt: "2026-08-15T12:00:00Z",
        recordedAt: "2026-08-15T12:00:01Z",
        evidence: { outcomeHeadSha: "abc" },
      }),
    ).toMatchObject({
      schemaVersion: 2,
      recordType: "finding-outcome",
      outcomeVersion: 2,
      outcome: "confirmed-fixed",
      evidence: { outcomeHeadSha: "abc" },
    });
  });
});
