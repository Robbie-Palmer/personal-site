import { eq } from "drizzle-orm";
import { recipeImportJob } from "recipe-db/schema";
import type { Db } from "./db";
import type { ImportStage } from "./keys";

export async function markJobRunning(db: Db, jobId: string): Promise<void> {
  await db
    .update(recipeImportJob)
    .set({
      status: "running",
      currentStage: "extract",
      progressLabel: "Reading the recipe from your photos",
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
