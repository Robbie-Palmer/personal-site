import { and, count, eq } from "drizzle-orm";
import { NonRetryableError } from "cloudflare:workflows";
import { recipeImportAttempt } from "recipe-db/schema";
import { extractAttemptErrorDetail } from "recipe-parsing/attempts";
import { isRetryableParseError } from "recipe-parsing/parse-retry";
import type { LlmResult, LlmUsage } from "recipe-parsing/openrouter";
import { withDb, type Db } from "./db";
import type { Env } from "./env";
import type { ImportStage } from "./keys";

async function nextAttemptNumber(
  db: Db,
  jobId: string,
  stage: ImportStage,
): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(recipeImportAttempt)
    .where(
      and(
        eq(recipeImportAttempt.jobId, jobId),
        eq(recipeImportAttempt.stage, stage),
      ),
    );
  return (row?.value ?? 0) + 1;
}

// Attempt rows are observability, not correctness: recording failures must
// never mask or replace the provider call outcome.
async function recordAttempt(
  env: Env,
  params: {
    jobId: string;
    stage: ImportStage;
    model: string;
    succeeded: boolean;
    durationMs: number;
    usage?: LlmUsage;
    retryable?: boolean;
    providerRequestId?: string;
    errorType?: string;
    errorMessage?: string;
  },
): Promise<void> {
  try {
    await withDb(env, async (db) => {
      const attempt = await nextAttemptNumber(db, params.jobId, params.stage);
      await db
        .insert(recipeImportAttempt)
        .values({
          jobId: params.jobId,
          stage: params.stage,
          attempt,
          succeeded: params.succeeded,
          retryable: params.retryable,
          providerRequestId: params.providerRequestId,
          errorType: params.errorType,
          errorMessage: params.errorMessage,
          durationMs: params.durationMs,
          model: params.model,
          promptTokens: params.usage?.promptTokens,
          completionTokens: params.usage?.completionTokens,
          totalTokens: params.usage?.totalTokens,
        })
        .onConflictDoNothing();
    });
  } catch (error) {
    console.warn(
      `Failed to record ${params.stage} attempt for job ${params.jobId}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * Run one provider call, recording an attempt row either way. Non-retryable
 * provider errors are converted to NonRetryableError so Workflows stops
 * retrying the step.
 */
export async function runLlmCall<T>(params: {
  env: Env;
  jobId: string;
  stage: ImportStage;
  model: string;
  call: () => Promise<LlmResult<T>>;
}): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await params.call();
    await recordAttempt(params.env, {
      jobId: params.jobId,
      stage: params.stage,
      model: params.model,
      succeeded: true,
      durationMs: Date.now() - startedAt,
      usage: result.usage,
    });
    return result.value;
  } catch (error) {
    const detail = extractAttemptErrorDetail(error, 0);
    await recordAttempt(params.env, {
      jobId: params.jobId,
      stage: params.stage,
      model: params.model,
      succeeded: false,
      durationMs: Date.now() - startedAt,
      retryable: detail.retryable,
      providerRequestId: detail.requestId,
      errorType: detail.errorType,
      errorMessage: detail.errorMessage,
    });
    if (!isRetryableParseError(error)) {
      throw new NonRetryableError(detail.errorMessage);
    }
    throw error;
  }
}
