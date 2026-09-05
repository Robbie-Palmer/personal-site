import type {
  OriginatingAgent,
  PullRequestMetadata,
  PullRequestTaskType,
} from "./records";

interface PullRequestClassificationInput {
  author?: string;
  headRef?: string;
  labels?: string[];
  title?: string;
}

const TASK_LABELS: Record<PullRequestTaskType, readonly string[]> = {
  bug: ["bug", "fix"],
  dependency: ["dependencies", "dependency"],
  documentation: ["documentation", "docs"],
  feature: ["enhancement", "feature"],
};

export function inferPullRequestTaskType({
  author,
  headRef,
  labels = [],
  title,
}: PullRequestClassificationInput): PullRequestTaskType | undefined {
  const normalizedLabels = new Set(labels.map((label) => label.toLowerCase()));
  for (const [taskType, candidates] of Object.entries(TASK_LABELS) as Array<
    [PullRequestTaskType, readonly string[]]
  >) {
    if (candidates.some((label) => normalizedLabels.has(label))) return taskType;
  }

  const normalizedTitle = title?.trim().toLowerCase() ?? "";
  const normalizedAuthor = author?.trim().toLowerCase() ?? "";
  if (
    /^(?:chore|build|ci)\(deps(?:-[^)]+)?\)!?:/.test(normalizedTitle) ||
    /^(?:update dependenc(?:y|ies)|lock file maintenance)\b/.test(normalizedTitle) ||
    /(?:dependabot|renovate)/.test(normalizedAuthor)
  ) {
    return "dependency";
  }
  if (/^(?:fix|bugfix|hotfix)(?:\([^)]+\))?!?:/.test(normalizedTitle)) return "bug";
  if (/^(?:docs|documentation)(?:\([^)]+\))?!?:/.test(normalizedTitle)) return "documentation";
  if (/^feat(?:\([^)]+\))?!?:/.test(normalizedTitle)) return "feature";

  const normalizedHead = headRef?.trim().toLowerCase() ?? "";
  if (/(^|\/)(?:fix|bugfix|hotfix)[\/-]/.test(normalizedHead)) return "bug";
  if (/(^|\/)(?:docs|documentation)[\/-]/.test(normalizedHead)) return "documentation";
  if (/^(?:add|create|feature|implement|improve|introduce)\b/.test(normalizedTitle)) return "feature";
  return undefined;
}

export function inferOriginatingAgent({
  headRef,
  title,
}: PullRequestClassificationInput): OriginatingAgent | undefined {
  const source = `${title ?? ""} ${headRef ?? ""}`.toLowerCase();
  if (/(^|[^a-z0-9])t3[-_]?code([^a-z0-9]|$)/.test(source)) return "t3-code";
  if (/(^|[^a-z])claude([^a-z]|$)/.test(source)) return "claude";
  if (/(^|[^a-z])codex([^a-z]|$)/.test(source)) return "codex";
  if (/(^|[^a-z])opencode([^a-z]|$)/.test(source)) return "opencode";
  return undefined;
}

export function completePullRequestMetadata(metadata: PullRequestMetadata): PullRequestMetadata {
  return {
    ...metadata,
    taskType: metadata.taskType ?? inferPullRequestTaskType(metadata),
    originatingAgent: metadata.originatingAgent ?? inferOriginatingAgent(metadata),
  };
}
