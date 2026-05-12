export interface CanonicalizationFile {
  entries: CanonicalizationEntry[];
}

export interface CanonicalizationEntry {
  images: string[];
  decisions: CanonicalizationDecision[];
  cookwareDecisions?: CookwareCanonicalizationDecision[];
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

export interface CookwareCanonicalizationDecision {
  originalName: string;
  baseName: string;
  canonicalName: string;
  method: "exact" | "none";
  candidates: Array<{
    name: string;
    score: number;
  }>;
}

export interface CanonicalIngredient {
  slug: string;
  category: string;
}

export interface CanonicalIngredientsData {
  ingredients: CanonicalIngredient[];
}
