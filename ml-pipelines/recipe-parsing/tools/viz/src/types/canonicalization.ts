export interface CanonicalizationFile {
  entries: CanonicalizationEntry[];
}

export interface CanonicalizationEntry {
  images: string[];
  decisions: CanonicalizationDecision[];
}

export interface CanonicalizationDecision {
  originalSlug: string;
  baseSlug: string;
  canonicalSlug: string;
  method: CanonicalizationMethod;
  score?: number;
  threshold?: number;
  margin?: number;
  reason?: string | null;
  candidates: CanonicalizationCandidate[];
}

export type CanonicalizationMethod = "exact" | "fuzzy" | "none";

export interface CanonicalizationCandidate {
  slug: string;
  score: number;
}
