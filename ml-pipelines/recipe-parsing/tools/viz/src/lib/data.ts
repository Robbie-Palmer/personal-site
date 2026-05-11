import type { z } from "zod";
import {
  GroundTruthDatasetSchema,
  PredictionsDatasetSchema,
} from "../../../../src/schemas/ground-truth.js";
import { CooklangPredictionsDatasetSchema } from "../../../../src/schemas/stage-artifacts.js";
import type { ReviewManifest, ReviewEntry } from "../types/review";
import type { CanonicalizationFile } from "../types/canonicalization";
import type { CanonicalIngredient, CanonicalIngredientsData } from "../types/canonicalization";
import type {
  CooklangPredictionsDataset,
  ExtractionPredictionsDataset,
  GroundTruthDataset,
  PerImageScoreEntry,
  PredictionsDataset,
  StageMetrics,
} from "../types/extraction";

const PIPELINE_BASE = "/pipeline";

export interface SaveGroundTruthResponse {
  ok: boolean;
  message?: string;
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${PIPELINE_BASE}${path}`);
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  return res.json();
}

async function fetchAndParse<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const raw = await fetchJson<unknown>(path);
  return schema.parse(raw);
}

export function loadManifest(): Promise<ReviewManifest> {
  return fetchJson("/outputs/review/manifest.json");
}

export function loadEntry(entryId: string): Promise<ReviewEntry> {
  return fetchJson(`/outputs/review/entries/${entryId}.json`);
}

export function loadCanonicalization(): Promise<CanonicalizationFile> {
  return fetchJson("/outputs/canonicalization-decisions.json");
}

export function loadGroundTruth(): Promise<GroundTruthDataset> {
  return fetchAndParse("/data/ground-truth.json", GroundTruthDatasetSchema);
}

export function loadPredictions(): Promise<PredictionsDataset> {
  return fetchAndParse("/outputs/predictions.json", PredictionsDatasetSchema);
}

export function loadExtractionPredictions(): Promise<ExtractionPredictionsDataset> {
  return fetchJson("/outputs/extraction-predictions.json");
}

export function loadCooklangPredictions(): Promise<CooklangPredictionsDataset> {
  return fetchAndParse("/outputs/cooklang-recipes.json", CooklangPredictionsDatasetSchema) as Promise<CooklangPredictionsDataset>;
}

export function loadCanonicalizedPredictions(): Promise<PredictionsDataset> {
  return fetchAndParse("/outputs/predictions-canonicalized.json", PredictionsDatasetSchema);
}

export function loadExtractionScores(): Promise<PerImageScoreEntry[]> {
  return fetchJson("/outputs/extraction-per-image-scores.json");
}

export function loadNormalizationScores(): Promise<PerImageScoreEntry[]> {
  return fetchJson("/outputs/normalization-per-image-scores.json");
}

export function loadFinalScores(): Promise<PerImageScoreEntry[]> {
  return fetchJson("/outputs/per-image-scores.json");
}

export function loadExtractionMetrics(): Promise<StageMetrics | { skipped: true }> {
  return fetchJson("/outputs/extraction-metrics.json");
}

export function loadNormalizationMetrics(): Promise<StageMetrics | { skipped: true }> {
  return fetchJson("/outputs/normalization-metrics.json");
}

export function loadFinalMetrics(): Promise<StageMetrics> {
  return fetchJson("/outputs/metrics.json");
}

export async function saveGroundTruth(
  data: GroundTruthDataset,
): Promise<SaveGroundTruthResponse> {
  const res = await fetch(`${PIPELINE_BASE}/api/ground-truth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to save ground truth: ${res.status} ${text}`);
  }
  return res.json();
}

export function loadCanonicalIngredients(): Promise<CanonicalIngredientsData> {
  return fetchJson("/data/canonical-ingredients.json");
}

export async function saveCanonicalIngredients(
  data: CanonicalIngredientsData,
): Promise<SaveGroundTruthResponse> {
  const res = await fetch(`${PIPELINE_BASE}/api/canonical-ingredients`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to save canonical ingredients: ${res.status} ${text}`);
  }
  return res.json();
}

export function imageUrl(imagePath: string): string {
  return `${PIPELINE_BASE}/${imagePath}`;
}
