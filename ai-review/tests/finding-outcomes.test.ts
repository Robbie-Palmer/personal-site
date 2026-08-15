import { describe, expect, it } from "vitest";
import {
  buildFindingOutcomeRecord,
  classifyFinalizedFinding,
  confirmsFindingFixed,
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

  it("confirms a fix only with an affirmative controlled replay", () => {
    const baseline = {
      alreadyConfirmed: false,
      rediscovered: false,
      replayVerdict: "fixed" as const,
      firstSeenHeadSha: "a",
      reviewedHeadSha: "b",
      file: "app.ts",
      priorHunkIds: ["old-hunk"],
      currentHunkIds: new Set(["new-hunk"]),
      reviewedFiles: new Set(["app.ts"]),
    };
    expect(confirmsFindingFixed(baseline)).toBe(true);
    expect(confirmsFindingFixed({ ...baseline, rediscovered: true })).toBe(false);
    expect(confirmsFindingFixed({
      ...baseline,
      replayVerdict: "uncertain",
    })).toBe(false);
    expect(confirmsFindingFixed({
      ...baseline,
      currentHunkIds: new Set(["old-hunk"]),
    })).toBe(false);
    expect(confirmsFindingFixed({
      ...baseline,
      reviewedFiles: new Set(["other.ts"]),
    })).toBe(false);
    expect(confirmsFindingFixed({
      ...baseline,
      alreadyConfirmed: true,
    })).toBe(false);
    expect(confirmsFindingFixed({
      ...baseline,
      reviewedHeadSha: "a",
    })).toBe(false);
    expect(confirmsFindingFixed({ ...baseline, priorHunkIds: [] })).toBe(false);
  });

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
