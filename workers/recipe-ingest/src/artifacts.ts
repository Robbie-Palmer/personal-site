import { recipeImportArtifact } from "recipe-db/schema";
import { artifactKey, type ImportStage } from "./keys";
import type { Db } from "./db";
import type { Env } from "./env";

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Write an immutable JSON snapshot to R2 and upsert its Postgres manifest row.
 * Keyed by (job, stage, kind) so workflow step replays cannot duplicate.
 */
export async function writeArtifact(params: {
  env: Env;
  db: Db;
  jobId: string;
  stage: ImportStage;
  kind: string;
  filename: string;
  payload: unknown;
  model?: string;
  preview?: unknown;
}): Promise<{ r2Key: string; checksum: string }> {
  const body = JSON.stringify(params.payload, null, 2);
  const r2Key = artifactKey(params.jobId, params.stage, params.filename);
  const checksum = await sha256Hex(body);

  await params.env.ARTIFACTS.put(r2Key, body, {
    httpMetadata: { contentType: "application/json" },
  });
  await params.db
    .insert(recipeImportArtifact)
    .values({
      jobId: params.jobId,
      stage: params.stage,
      kind: params.kind,
      r2Key,
      checksum,
      model: params.model,
      provider: params.model === undefined ? undefined : "openrouter",
      preview: params.preview,
    })
    .onConflictDoNothing();

  return { r2Key, checksum };
}
