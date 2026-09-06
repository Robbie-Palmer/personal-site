import { eq } from "drizzle-orm";
import { recipeImportJob } from "recipe-db/schema";
import type { ImportStage } from "recipe-import-storage/keys";
import type { Db } from "./db";

export async function markJobRunning(
  db: Db,
  jobId: string,
  workflowInstanceId: string,
): Promise<void> {
  await db
    .update(recipeImportJob)
    .set({
      status: "running",
      currentStage: "extract",
      progressLabel: "Reading the recipe from your photos",
      workflowInstanceId,
    })
    .where(eq(recipeImportJob.id, jobId));
}

export async function updateJobStage(
  db: Db,
  jobId: string,
  stage: ImportStage,
  progressLabel: string,
): Promise<void> {
  await db
    .update(recipeImportJob)
    .set({ currentStage: stage, progressLabel })
    .where(eq(recipeImportJob.id, jobId));
}

export async function markJobSucceeded(db: Db, jobId: string): Promise<void> {
  await db
    .update(recipeImportJob)
    .set({
      status: "succeeded",
      progressLabel: "Draft ready",
      finishedAt: new Date(),
    })
    .where(eq(recipeImportJob.id, jobId));
}

export async function markJobFailed(
  db: Db,
  jobId: string,
  errorType: string,
  errorMessage: string,
): Promise<void> {
  await db
    .update(recipeImportJob)
    .set({
      status: "failed",
      progressLabel: "Import failed",
      errorType,
      errorMessage,
      finishedAt: new Date(),
    })
    .where(eq(recipeImportJob.id, jobId));
}
