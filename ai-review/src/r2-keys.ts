export type ReviewRunTerminalStatus =
  | "denied"
  | "failed"
  | "published"
  | "skipped";

interface PullRequestKeyParts {
  repository: string;
  pullRequestNumber: number;
}

export function findingRecordsPrefix(parts: PullRequestKeyParts): string {
  return [
    "v2",
    parts.repository,
    `pr-${parts.pullRequestNumber}`,
    "findings",
  ].join("/");
}

export function findingOutcomeKey(
  parts: PullRequestKeyParts & {
    findingId: string;
    outcomeVersion: number;
  },
): string {
  return [
    findingRecordsPrefix(parts),
    parts.findingId,
    "outcomes",
    `v${parts.outcomeVersion}.json`,
  ].join("/");
}

export function findingEvidenceKey(
  parts: PullRequestKeyParts & {
    findingId: string;
    deliveryId: string;
  },
): string {
  return [
    findingRecordsPrefix(parts),
    parts.findingId,
    "evidence",
    `${parts.deliveryId}.json`,
  ].join("/");
}

export function reviewRunTerminalKey(
  parts: PullRequestKeyParts & {
    headSha: string;
    instanceId: string;
    status: ReviewRunTerminalStatus;
  },
): string {
  return [
    "v2",
    parts.repository,
    `pr-${parts.pullRequestNumber}`,
    parts.headSha,
    parts.instanceId,
    `${parts.status}.json`,
  ].join("/");
}
