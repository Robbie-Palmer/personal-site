export type Env = {
  HYPERDRIVE?: Hyperdrive;
  DATABASE_URL?: string;
  ARTIFACTS: R2Bucket;
  RECIPE_INGEST_WORKFLOW: Workflow;
  OPENROUTER_API_KEY: string;
  EXTRACT_MODEL?: string;
  EXTRACT_TIMEOUT_MS?: string;
  EXTRACT_RETRIES?: string;
  NORMALIZE_MODEL?: string;
  NORMALIZE_TIMEOUT_MS?: string;
  NORMALIZE_RETRIES?: string;
  CANONICALIZE_MODEL?: string;
  CANONICALIZE_TIMEOUT_MS?: string;
  CANONICALIZE_RETRIES?: string;
};
