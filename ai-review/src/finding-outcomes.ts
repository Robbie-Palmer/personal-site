import type { FindingOutcome } from "./env";

export type FindingOutcomeBasis =
  | "explicit-disposition"
  | "later-reviewed-head"
  | "pull-request-finalization";

export type FindingOutcomeRecord = {
  schemaVersion: 2;
  recordType: "finding-outcome";
  outcomeVersion: number;
  repository: string;
  pullRequestNumber: number;
  findingId: string;
  outcome: FindingOutcome;
  basis: FindingOutcomeBasis;
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
    basis: options.basis,
    sourceId: options.sourceId,
    evidence: options.evidence,
    occurredAt: options.occurredAt,
    recordedAt: options.recordedAt,
  };
}

export function classifyFinalizedFinding(options: {
  disposition: string | null;
  finalHeadWasReviewed: boolean;
  affectedCodeRemains: boolean;
}): FindingOutcome {
  if (
    options.disposition === "acknowledged" ||
    options.disposition === "rejected"
  ) {
    return options.disposition;
  }
  return options.finalHeadWasReviewed && !options.affectedCodeRemains
    ? "superseded"
    : "no-observable-response";
}
