export const WORK_ITEM_LIFECYCLES = [
  "open",
  "released",
  "cancelled",
] as const;

export type WorkItemLifecycle = (typeof WORK_ITEM_LIFECYCLES)[number];

export const WORK_STAGES = [
  "blocked",
  "ready",
  "in_progress",
  "stale",
  "needs_attention",
  "released",
  "cancelled",
] as const;

export type WorkStage = (typeof WORK_STAGES)[number];

export const LEASE_OUTCOMES = [
  "released",
  "cancelled",
  "decomposed",
  "attention_requested",
  "expired",
] as const;

export type LeaseOutcome = (typeof LEASE_OUTCOMES)[number];

export const PULL_REQUEST_ROLES = [
  "implementation",
  "evidence",
  "related",
] as const;

export type PullRequestRole = (typeof PULL_REQUEST_ROLES)[number];
