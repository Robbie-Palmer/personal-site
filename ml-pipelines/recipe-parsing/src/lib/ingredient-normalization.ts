import { normalizeSlug } from "recipe-domain/slugs";
import {
  pluralizeIngredientTerm,
  singularizeIngredientTerm,
} from "recipe-domain/pluralization";
import type { PredictionEntry, Recipe } from "../schemas/ground-truth.js";

export type MatchScope = "local" | "global";

export type NormalizationMethod =
  | "exact-local"
  | "exact-global"
  | "rule-local"
  | "rule-global"
  | "fuzzy-local"
  | "fuzzy-global"
  | "none";

export interface CandidateScore {
  slug: string;
  score: number;
  scope: MatchScope;
}

export interface IngredientNormalizationDecision {
  originalSlug: string;
  baseSlug: string;
  normalizedSlug: string;
  method: NormalizationMethod;
  reason?: "below-threshold" | "ambiguous" | "no-candidates";
  score?: number;
  threshold?: number;
  margin?: number;
  candidates: CandidateScore[];
}

export interface EntryNormalizationDecisions {
  images: string[];
  decisions: IngredientNormalizationDecision[];
}

const TOKEN_FIXUPS: Record<string, string> = {
  clov: "clove",
  flak: "flakes",
  sausag: "sausages",
  veg: "vegetables",
};

const MODIFIER_TOKENS = new Set([
  "fresh",
  "dried",
  "dry",
  "frozen",
  "light",
  "extra",
  "medium",
  "semi",
  "skimmed",
  "hot",
]);

const NOISE_TOKENS = new Set([
  "of",
  "slice",
  "slices",
  "cooked",
  "extra",
]);

const EXACT_ALIASES: Record<string, string> = {
  onion: "white-onion",
  "chicken-fillet": "chicken-breast",
  "garlic-clove": "garlic",
  "red-pepper": "bell-pepper",
  "yellow-pepper": "bell-pepper",
  "green-pepper": "bell-pepper",
  sausage: "pork-sausage",
};

const LOCAL_FUZZY_THRESHOLD = 0.7;
const GLOBAL_FUZZY_THRESHOLD = 0.85;
const FUZZY_MARGIN = 0.04;

export function normalizeIngredientSlug(slug: string): string {
  return normalizeSlug(slug);
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function tokenize(slug: string): string[] {
  return slug.split("-").filter(Boolean);
}

function detokenize(tokens: string[]): string {
  return tokens.join("-");
}

function applyTokenFixups(tokens: string[]): string[] {
  return tokens.map((token) => TOKEN_FIXUPS[token] ?? token);
}

function generateDeterministicCandidates(slug: string): string[] {
  const base = normalizeSlug(slug);
  const out = new Set<string>([base]);
  const tokens = tokenize(base);

  const fixedTokens = applyTokenFixups(tokens);
  out.add(detokenize(fixedTokens));

  if (fixedTokens.length === 2) {
    out.add(detokenize([fixedTokens[1]!, fixedTokens[0]!]));
  }

  const withoutModifiers = fixedTokens.filter((token) => !MODIFIER_TOKENS.has(token));
  if (withoutModifiers.length > 0 && withoutModifiers.length !== fixedTokens.length) {
    out.add(detokenize(withoutModifiers));
  }

  const withoutNoise = fixedTokens.filter((token) => !NOISE_TOKENS.has(token));
  if (withoutNoise.length > 0 && withoutNoise.length !== fixedTokens.length) {
    out.add(detokenize(withoutNoise));
  }

  if (fixedTokens.length > 2 && fixedTokens.includes("and")) {
    out.add(detokenize(fixedTokens.filter((token) => token !== "and")));
  }

  if (withoutNoise.length > 2 && withoutNoise.includes("and")) {
    out.add(detokenize(withoutNoise.filter((token) => token !== "and")));
  }

  if (base.endsWith("-cheese")) {
    out.add(base.replace(/-cheese$/, ""));
  }
  if (base.endsWith("-powder")) {
    out.add(base.replace(/-powder$/, ""));
  }

  for (const candidate of [...out]) {
    const phrase = candidate.replace(/-/g, " ");
    const singular = normalizeSlug(singularizeIngredientTerm(phrase));
    const plural = normalizeSlug(pluralizeIngredientTerm(phrase));
    if (singular) out.add(singular);
    if (plural) out.add(plural);
  }

  for (const candidate of [...out]) {
    const alias = EXACT_ALIASES[candidate];
    if (alias) out.add(alias);
  }

  return unique([...out]);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const dp = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );

  for (let i = 0; i <= a.length; i++) dp[i]![0] = i;
  for (let j = 0; j <= b.length; j++) dp[0]![j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + cost,
      );
    }
  }

  return dp[a.length]![b.length]!;
}

function scoreSimilarity(left: string, right: string): number {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  const tokenScore = union === 0 ? 0 : intersection / union;

  const distance = levenshtein(left, right);
  const maxLen = Math.max(left.length, right.length, 1);
  const editScore = 1 - distance / maxLen;

  return 0.6 * tokenScore + 0.4 * editScore;
}

function exactCandidate(
  candidates: string[],
  scope: MatchScope,
  ontology: Set<string>,
  method: NormalizationMethod,
): { slug: string; method: NormalizationMethod; scope: MatchScope } | undefined {
  for (const candidate of candidates) {
    if (ontology.has(candidate)) {
      return { slug: candidate, method, scope };
    }
  }
  return undefined;
}

function topFuzzyCandidates(
  candidates: string[],
  scope: MatchScope,
  ontology: Set<string>,
): CandidateScore[] {
  const scored: CandidateScore[] = [];
  for (const candidate of candidates) {
    for (const slug of ontology) {
      scored.push({
        slug,
        score: scoreSimilarity(candidate, slug),
        scope,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug));
  return unique(scored.map((row) => `${row.scope}:${row.slug}`))
    .map((key) => {
      const [scopeValue, slug] = key.split(":");
      return scored.find((row) => row.scope === scopeValue && row.slug === slug)!;
    })
    .slice(0, 5);
}

export function canonicalizeIngredientSlug(params: {
  rawSlug: string;
  localOntology: Set<string>;
  globalOntology: Set<string>;
}): IngredientNormalizationDecision {
  const baseSlug = normalizeSlug(params.rawSlug);
  const ruleCandidates = generateDeterministicCandidates(params.rawSlug);

  const exactLocal = exactCandidate(ruleCandidates, "local", params.localOntology, "exact-local");
  if (exactLocal) {
    return {
      originalSlug: params.rawSlug,
      baseSlug,
      normalizedSlug: exactLocal.slug,
      method: exactLocal.method,
      score: 1,
      threshold: 1,
      candidates: [{ slug: exactLocal.slug, score: 1, scope: "local" }],
    };
  }

  const exactGlobal = exactCandidate(
    ruleCandidates,
    "global",
    params.globalOntology,
    "exact-global",
  );
  if (exactGlobal) {
    return {
      originalSlug: params.rawSlug,
      baseSlug,
      normalizedSlug: exactGlobal.slug,
      method: exactGlobal.method,
      score: 1,
      threshold: 1,
      candidates: [{ slug: exactGlobal.slug, score: 1, scope: "global" }],
    };
  }

  const localFuzzy = topFuzzyCandidates(ruleCandidates, "local", params.localOntology);
  const globalFuzzy = topFuzzyCandidates(ruleCandidates, "global", params.globalOntology);

  const allCandidates = [...localFuzzy, ...globalFuzzy]
    .sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug))
    .slice(0, 5);

  const bestLocal = localFuzzy[0];
  if (bestLocal && bestLocal.score >= LOCAL_FUZZY_THRESHOLD) {
    const second = localFuzzy[1];
    const margin = second ? bestLocal.score - second.score : 1;
    if (margin >= FUZZY_MARGIN) {
      return {
        originalSlug: params.rawSlug,
        baseSlug,
        normalizedSlug: bestLocal.slug,
        method: "fuzzy-local",
        score: bestLocal.score,
        threshold: LOCAL_FUZZY_THRESHOLD,
        margin,
        candidates: allCandidates,
      };
    }
    return {
      originalSlug: params.rawSlug,
      baseSlug,
      normalizedSlug: baseSlug,
      method: "none",
      reason: "ambiguous",
      score: bestLocal.score,
      threshold: LOCAL_FUZZY_THRESHOLD,
      margin,
      candidates: allCandidates,
    };
  }

  const bestGlobal = globalFuzzy[0];
  if (bestGlobal && bestGlobal.score >= GLOBAL_FUZZY_THRESHOLD) {
    const second = globalFuzzy[1];
    const margin = second ? bestGlobal.score - second.score : 1;
    if (margin >= FUZZY_MARGIN) {
      return {
        originalSlug: params.rawSlug,
        baseSlug,
        normalizedSlug: bestGlobal.slug,
        method: "fuzzy-global",
        score: bestGlobal.score,
        threshold: GLOBAL_FUZZY_THRESHOLD,
        margin,
        candidates: allCandidates,
      };
    }
    return {
      originalSlug: params.rawSlug,
      baseSlug,
      normalizedSlug: baseSlug,
      method: "none",
      reason: "ambiguous",
      score: bestGlobal.score,
      threshold: GLOBAL_FUZZY_THRESHOLD,
      margin,
      candidates: allCandidates,
    };
  }

  return {
    originalSlug: params.rawSlug,
    baseSlug,
    normalizedSlug: baseSlug,
    method: "none",
    reason: allCandidates.length > 0 ? "below-threshold" : "no-candidates",
    score: allCandidates[0]?.score,
    threshold: GLOBAL_FUZZY_THRESHOLD,
    margin:
      allCandidates.length > 1 ? allCandidates[0]!.score - allCandidates[1]!.score : undefined,
    candidates: allCandidates,
  };
}

export function normalizeRecipeIngredients(
  recipe: Recipe,
  ontology: { local: Set<string>; global: Set<string> },
): { recipe: Recipe; decisions: IngredientNormalizationDecision[] } {
  const decisions: IngredientNormalizationDecision[] = [];

  const normalizedRecipe: Recipe = {
    ...recipe,
    ingredientGroups: recipe.ingredientGroups.map((group) => ({
      ...group,
      items: group.items.map((item) => {
        const decision = canonicalizeIngredientSlug({
          rawSlug: item.ingredient,
          localOntology: ontology.local,
          globalOntology: ontology.global,
        });
        decisions.push(decision);
        return {
          ...item,
          ingredient: decision.normalizedSlug,
        };
      }),
    })),
  };

  return { recipe: normalizedRecipe, decisions };
}

function normalizeCuisineLabel(cuisine: string | undefined): string | undefined {
  if (cuisine === undefined) return undefined;
  const trimmed = cuisine.trim();
  if (!trimmed) return "";

  const firstSegment = trimmed.split("-")[0]?.trim() ?? "";
  return firstSegment || "";
}

export function normalizePredictionEntry(
  entry: PredictionEntry,
  ontology: { local: Set<string>; global: Set<string> },
): { entry: PredictionEntry; decisions: IngredientNormalizationDecision[] } {
  const normalized = normalizeRecipeIngredients(entry.predicted, ontology);
  return {
    entry: {
      ...entry,
      predicted: {
        ...normalized.recipe,
        cuisine: normalizeCuisineLabel(normalized.recipe.cuisine),
      },
    },
    decisions: normalized.decisions,
  };
}
