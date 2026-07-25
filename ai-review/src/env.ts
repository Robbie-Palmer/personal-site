export type ReviewWorkflowParams = {
  deliveryId: string;
  eventName: string;
  action: string;
  repository: string;
  pullRequestNumber: number;
  headSha?: string;
};

export interface Env {
  AI: Ai;
  PR_STATE: DurableObjectNamespace;
  REVIEW_DATA: R2Bucket;
  REVIEW_WORKFLOW: Workflow<ReviewWorkflowParams>;
  AI_REVIEW_ENABLED: string;
  AI_REVIEW_REPOSITORY: string;
  AI_REVIEW_DEBOUNCE_SECONDS: string;
  AI_REVIEW_DATA_RETENTION_DAYS: string;
  AI_REVIEW_SCOUT_MODEL: string;
  AI_REVIEW_PROMPT_VERSION: string;
  AI_REVIEW_APP_ID: string;
  AI_REVIEW_APP_INSTALLATION_ID: string;
  AI_REVIEW_APP_PRIVATE_KEY: string;
  AI_REVIEW_WEBHOOK_SECRET: string;
  OPENROUTER_API_KEY: string;
}
