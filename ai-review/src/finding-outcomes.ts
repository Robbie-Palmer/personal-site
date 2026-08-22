import type { FindingOutcome } from "./env";

export const DEFAULT_FINDING_OUTCOME_EVALUATOR_VERSION =
  "deterministic-outcomes-v1";

export type FindingOutcomeBasis =
  | "explicit-disposition"
  | "later-reviewed-head"
  | "pull-request-finalization"
  | "outcome-window";

export type FindingOutcomeKind = "adjudicated" | "censored" | "workflow";

export type FindingOutcomeManualOverride = {
  actor: string;
  deliveryId: string;
  reason: string;
};

export type FindingInteractionSummary = {
  deliveryIds: string[];
  replies: number;
  threadResolutions: number;
  threadUnresolutions: number;
  positiveReactions: number;
  negativeReactions: number;
};

export type FinalizedFindingEvaluation = {
  outcome?: FindingOutcome;
  basis?: FindingOutcomeBasis;
  confidence?: number;
  status: "resolved" | "incomplete" | "manual-adjudication-required";
  evidence: Record<string, unknown>;
};

export type FindingOutcomeRecord = {
  schemaVersion: 2;
  recordType: "finding-outcome";
  outcomeVersion: number;
  repository: string;
  pullRequestNumber: number;
  findingId: string;
  outcome: FindingOutcome;
  outcomeKind: FindingOutcomeKind;
  basis: FindingOutcomeBasis;
  confidence: number;
  evaluatorVersion: string;
  manualOverride: FindingOutcomeManualOverride | null;
  sourceId: string;
  evidence: Record<string, unknown>;
  occurredAt: string;
  recordedAt: string;
};

export function buildFindingOutcomeRecord(options: {
  repository: string;
  pullRequestNumber: number;
  findingId: string;
  outcome: FindingOutcome;
  basis: FindingOutcomeBasis;
  confidence: number;
  evaluatorVersion: string;
  manualOverride?: FindingOutcomeManualOverride;
  sourceId: string;
  outcomeVersion: number;
  occurredAt: string;
  recordedAt: string;
  evidence: Record<string, unknown>;
}): FindingOutcomeRecord {
  return {
    schemaVersion: 2,
    recordType: "finding-outcome",
    outcomeVersion: options.outcomeVersion,
    repository: options.repository,
    pullRequestNumber: options.pullRequestNumber,
    findingId: options.findingId,
    outcome: options.outcome,
    outcomeKind: findingOutcomeKind(options.outcome),
    basis: options.basis,
    confidence: options.confidence,
    evaluatorVersion: options.evaluatorVersion,
    manualOverride: options.manualOverride ?? null,
    sourceId: options.sourceId,
    evidence: options.evidence,
    occurredAt: options.occurredAt,
    recordedAt: options.recordedAt,
  };
}

export function findingOutcomeKind(
  outcome: FindingOutcome,
): FindingOutcomeKind {
  if (outcome === "no-observable-response") return "workflow";
  if (outcome === "superseded") return "censored";
  return "adjudicated";
}

export function evaluateFinalizedFinding(options: {
  disposition: string | null;
  finalHeadWasReviewed: boolean;
  affectedCodeRemains: boolean;
  outcomeWindowElapsed: boolean;
  interactions: FindingInteractionSummary;
  laterResolutionVerdict?: "fixed" | "still-present" | "uncertain";
}): FinalizedFindingEvaluation {
  const evidence = {
    finalHeadWasReviewed: options.finalHeadWasReviewed,
    affectedCodeRemains: options.affectedCodeRemains,
    outcomeWindowElapsed: options.outcomeWindowElapsed,
    interactions: options.interactions,
    laterResolutionVerdict: options.laterResolutionVerdict,
  };
  if (
    options.disposition === "acknowledged" ||
    options.disposition === "rejected"
  ) {
    return {
      status: "resolved",
      outcome: options.disposition,
      basis: "explicit-disposition",
      confidence: 1,
      evidence,
    };
  }
  if (options.finalHeadWasReviewed && !options.affectedCodeRemains) {
    return {
      status: "resolved",
      outcome: "superseded",
      basis: "pull-request-finalization",
      confidence: 1,
      evidence,
    };
  }
  if (!options.outcomeWindowElapsed) {
    return { status: "incomplete", evidence };
  }
  const interactionCount =
    options.interactions.replies +
    options.interactions.threadResolutions +
    options.interactions.threadUnresolutions +
    options.interactions.positiveReactions +
    options.interactions.negativeReactions;
  if (
    interactionCount > 0 ||
    options.laterResolutionVerdict === "fixed"
  ) {
    return { status: "manual-adjudication-required", evidence };
  }
  return {
    status: "resolved",
    outcome: "no-observable-response",
    basis: "outcome-window",
    confidence: 1,
    evidence: {
      ...evidence,
      correctnessJudgment: false,
    },
  };
}
