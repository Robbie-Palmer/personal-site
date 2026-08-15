import { describe, expect, it } from "vitest";
import {
  buildFindingOutcomeRecord,
  classifyFinalizedFinding,
} from "../src/finding-outcomes";

describe("finding outcomes", () => {
  it.each([
    ["acknowledged", false, true, "acknowledged"],
    ["rejected", false, true, "rejected"],
    [null, true, false, "superseded"],
    [null, true, true, "no-observable-response"],
    [null, false, false, "no-observable-response"],
  ])(
    "classifies disposition=%s final coverage=%s",
    (
      disposition,
      finalHeadWasReviewed,
      affectedCodeRemains,
      expected,
    ) => {
      expect(
        classifyFinalizedFinding({
          disposition,
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
