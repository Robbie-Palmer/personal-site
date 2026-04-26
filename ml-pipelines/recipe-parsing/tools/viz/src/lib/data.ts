import type { ReviewManifest, ReviewEntry } from "../types/review";
import type { CanonicalizationFile } from "../types/canonicalization";
import type {
  CooklangPredictionsDataset,
  GroundTruthDataset,
  PredictionsDataset,
  StructuredTextPredictionsDataset,
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
  return fetchJson("/data/ground-truth.json");
}

export function loadPredictions(): Promise<PredictionsDataset> {
  return fetchJson("/outputs/predictions.json");
}

export function loadStructuredTextPredictions(): Promise<StructuredTextPredictionsDataset> {
  return fetchJson("/outputs/structured-extractions.json");
}

export function loadCooklangPredictions(): Promise<CooklangPredictionsDataset> {
  return fetchJson("/outputs/cooklang-recipes.json");
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

export function imageUrl(imagePath: string): string {
  return `${PIPELINE_BASE}/${imagePath}`;
}
