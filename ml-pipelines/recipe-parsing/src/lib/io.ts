import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import {
  GroundTruthDatasetSchema,
  PredictionsDatasetSchema,
  type GroundTruthDataset,
  type PredictionsDataset,
} from "../schemas/ground-truth.js";
import {
  InferFailuresDatasetSchema,
  type InferFailuresDataset,
} from "../schemas/infer-failures.js";

const DATA_DIR = "data";
const OUTPUTS_DIR = "outputs";

export const GROUND_TRUTH_PATH = join(DATA_DIR, "ground-truth.json");
export const IMAGES_DIR = join(DATA_DIR, "recipe-images");
export const PREPARED_PATH = join(OUTPUTS_DIR, "prepared.json");
export const PREDICTIONS_PATH = join(OUTPUTS_DIR, "predictions.json");
export const NORMALIZED_PREDICTIONS_PATH = join(OUTPUTS_DIR, "predictions-normalized.json");
export const NORMALIZATION_DECISIONS_PATH = join(OUTPUTS_DIR, "normalization-decisions.json");
export const METRICS_PATH = join(OUTPUTS_DIR, "metrics.json");
export const PER_IMAGE_SCORES_PATH = join(OUTPUTS_DIR, "per-image-scores.json");
export const INFER_FAILURES_PATH = join(OUTPUTS_DIR, "infer-failures.json");

export async function loadGroundTruth(): Promise<GroundTruthDataset> {
  const raw = JSON.parse(await readFile(GROUND_TRUTH_PATH, "utf-8"));
  return GroundTruthDatasetSchema.parse(raw);
}

export async function loadPreparedData(): Promise<GroundTruthDataset> {
  const raw = JSON.parse(await readFile(PREPARED_PATH, "utf-8"));
  return GroundTruthDatasetSchema.parse(raw);
}

export async function loadPredictions(): Promise<PredictionsDataset> {
  const raw = JSON.parse(await readFile(PREDICTIONS_PATH, "utf-8"));
  return PredictionsDatasetSchema.parse(raw);
}

export async function loadNormalizedPredictions(): Promise<PredictionsDataset> {
  const raw = JSON.parse(await readFile(NORMALIZED_PREDICTIONS_PATH, "utf-8"));
  return PredictionsDatasetSchema.parse(raw);
}

export async function loadInferFailures(): Promise<InferFailuresDataset> {
  if (!existsSync(INFER_FAILURES_PATH)) {
    return { entries: [] };
  }
  const raw = JSON.parse(await readFile(INFER_FAILURES_PATH, "utf-8"));
  return InferFailuresDatasetSchema.parse(raw);
}

export async function listImageFiles(): Promise<string[]> {
  if (!existsSync(IMAGES_DIR)) return [];
  const files = await readdir(IMAGES_DIR);
  return files.filter(
    (f) =>
      f.endsWith(".jpg") || f.endsWith(".jpeg") || f.endsWith(".png"),
  );
}

export async function writeJson(
  path: string,
  data: unknown,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2) + "\n");
}
