export type ReviewWorkflowParams = {
  deliveryId: string;
  eventName: string;
  action: string;
  repository: string;
  pullRequestNumber: number;
  headSha?: string;
  force: boolean;
};

export type FindingDisposition = "acknowledged" | "rejected";

export type FindingInteractionEvent = {
  deliveryId: string;
  eventName: string;
  action: string;
  repository: string;
  pullRequestNumber: number;
  interactionType: "reply" | "thread" | "disposition";
  actor: string;
  actorAssociation?: string;
  findingId?: string;
  rootCommentId?: number;
  commentId?: number;
  threadId?: string;
  body?: string;
  reactions?: Record<string, number>;
  disposition?: FindingDisposition;
  reason?: string;
  occurredAt?: string;
};

export const TRUSTED_AUTHOR_ASSOCIATIONS = new Set([
  "OWNER",
  "MEMBER",
  "COLLABORATOR",
]);

export interface Env {
  PR_STATE: DurableObjectNamespace;
  REVIEW_DATA: R2Bucket;
  REVIEW_WORKFLOW: Workflow<ReviewWorkflowParams>;
  AI_REVIEW_ENABLED: string;
  AI_REVIEW_REPOSITORY: string;
  AI_REVIEW_DEBOUNCE_SECONDS: string;
  AI_REVIEW_DATA_RETENTION_DAYS: string;
  AI_REVIEW_MODELS?: string;
  AI_REVIEW_OPENCODE_MODELS?: string;
  AI_REVIEW_MERGER_MODEL?: string;
  AI_REVIEW_IGNORED_AUTHORS?: string;
  AI_REVIEW_ZDR?: string;
  AI_REVIEW_APP_BOT_LOGIN: string;
  AI_REVIEW_MAX_PR_COST_USD: string;
  AI_REVIEW_MAX_RUNS_PER_PR: string;
  AI_REVIEW_PROMPT_VERSION: string;
  AI_REVIEW_APP_ID: string;
  AI_REVIEW_APP_INSTALLATION_ID: string;
  AI_REVIEW_APP_PRIVATE_KEY: string;
  AI_REVIEW_WEBHOOK_SECRET: string;
  OPENROUTER_API_KEY: string;
  OPENCODE_API_KEY?: string;
}
