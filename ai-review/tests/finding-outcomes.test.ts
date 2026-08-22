import { describe, expect, it } from "vitest";
import {
  buildFindingOutcomeRecord,
  evaluateFinalizedFinding,
} from "../src/finding-outcomes";

const noInteractions = {
  deliveryIds: [],
  replies: 0,
  threadResolutions: 0,
  threadUnresolutions: 0,
  positiveReactions: 0,
  negativeReactions: 0,
};

describe("finding outcomes", () => {
  it("waits for the outcome window before recording silence", () => {
    expect(
      evaluateFinalizedFinding({
        disposition: null,
        finalHeadWasReviewed: true,
        affectedCodeRemains: true,
        outcomeWindowElapsed: false,
        interactions: noInteractions,
      }),
    ).toMatchObject({ status: "incomplete" });
    expect(
      evaluateFinalizedFinding({
        disposition: null,
        finalHeadWasReviewed: true,
        affectedCodeRemains: true,
        outcomeWindowElapsed: true,
        interactions: noInteractions,
      }),
    ).toMatchObject({
      status: "resolved",
      outcome: "no-observable-response",
      basis: "outcome-window",
      evidence: { correctnessJudgment: false },
    });
  });

  it("sends conflicting or ambiguous evidence to manual adjudication", () => {
    expect(
      evaluateFinalizedFinding({
        disposition: null,
        finalHeadWasReviewed: true,
        affectedCodeRemains: true,
        outcomeWindowElapsed: true,
        interactions: {
          ...noInteractions,
          deliveryIds: ["reply-1", "thread-1"],
          replies: 1,
          threadResolutions: 1,
          negativeReactions: 1,
        },
        laterResolutionVerdict: "fixed",
      }),
    ).toMatchObject({ status: "manual-adjudication-required" });
  });

  it("builds a portable versioned record", () => {
    expect(
      buildFindingOutcomeRecord({
        repository: "owner/repository",
        pullRequestNumber: 42,
        findingId: `f_${"a".repeat(24)}`,
        outcome: "confirmed-fixed",
        basis: "later-reviewed-head",
        confidence: 0.95,
        evaluatorVersion: "deterministic-outcomes-v1",
        manualOverride: {
          actor: "maintainer",
          deliveryId: "override-1",
          reason: "Verified against the final diff",
        },
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
      outcomeKind: "adjudicated",
      confidence: 0.95,
      evaluatorVersion: "deterministic-outcomes-v1",
      manualOverride: { actor: "maintainer" },
      evidence: { outcomeHeadSha: "abc" },
    });
  });
});
