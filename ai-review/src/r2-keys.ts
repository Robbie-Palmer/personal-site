export type ReviewRunTerminalStatus =
  | "denied"
  | "failed"
  | "published"
  | "skipped";

interface PullRequestKeyParts {
  repository: string;
  pullRequestNumber: number;
}

function repositoryKeyPath(repository: string): string {
  const segments = repository.split("/");
  if (
    segments.length !== 2 ||
    segments.some(
      (segment) =>
        segment.length === 0 ||
        segment.trim() !== segment ||
        segment === "." ||
        segment === "..",
    )
  ) {
    throw new TypeError("repository must use the canonical owner/name form");
  }
  return repository;
}

export function findingRecordsPrefix(parts: PullRequestKeyParts): string {
  return [
    "v2",
    repositoryKeyPath(parts.repository),
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
    repositoryKeyPath(parts.repository),
    `pr-${parts.pullRequestNumber}`,
    parts.headSha,
    parts.instanceId,
    `${parts.status}.json`,
  ].join("/");
}
