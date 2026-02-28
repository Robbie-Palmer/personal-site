import { normalizeSlug } from "recipe-domain/slugs";
import {
  pluralizeIngredientTerm,
  singularizeIngredientTerm,
} from "recipe-domain/pluralization";
import type { PredictionEntry, Recipe } from "../schemas/ground-truth.js";

export type CanonicalizationMethod =
  | "exact"
  | "rule"
  | "fuzzy"
  | "none";

export interface CandidateScore {
  slug: string;
  score: number;
}

export interface IngredientCanonicalizationDecision {
  originalSlug: string;
  baseSlug: string;
  canonicalSlug: string;
  method: CanonicalizationMethod;
  reason?: "below-threshold" | "ambiguous" | "no-candidates";
  score?: number;
  threshold?: number;
  margin?: number;
  candidates: CandidateScore[];
}

export interface EntryCanonicalizationDecisions {
  images: string[];
  decisions: IngredientCanonicalizationDecision[];
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

const FUZZY_THRESHOLD = 0.85;
const FUZZY_MARGIN = 0.04;
const COMPOUND_CUISINES = new Set([
  "indo-chinese",
  "tex-mex",
]);

type OntologyIndex = {
  ontology: Set<string>;
  byLength: Map<number, string[]>;
  byToken: Map<string, Set<string>>;
};

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
  ontology: Set<string>,
): string | undefined {
  for (const candidate of candidates) {
    if (ontology.has(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

export function buildOntologyIndex(ontology: Set<string>): OntologyIndex {
  const byLength = new Map<number, string[]>();
  const byToken = new Map<string, Set<string>>();
  for (const slug of ontology) {
    const len = slug.length;
    const sameLen = byLength.get(len) ?? [];
    sameLen.push(slug);
    byLength.set(len, sameLen);

    for (const token of tokenize(slug)) {
      const slugs = byToken.get(token) ?? new Set<string>();
      slugs.add(slug);
      byToken.set(token, slugs);
    }
  }
  return { ontology, byLength, byToken };
}

function topFuzzyCandidates(
  candidates: string[],
  ontologyIndex: OntologyIndex,
): CandidateScore[] {
  if (ontologyIndex.ontology.size === 0 || candidates.length === 0) {
    return [];
  }

  const scored: CandidateScore[] = [];
  for (const candidate of candidates) {
    const shortlist = new Set<string>();
    for (const token of tokenize(candidate)) {
      for (const slug of ontologyIndex.byToken.get(token) ?? []) {
        shortlist.add(slug);
      }
    }
    if (shortlist.size === 0) {
      for (let len = candidate.length - 2; len <= candidate.length + 2; len++) {
        for (const slug of ontologyIndex.byLength.get(len) ?? []) {
          shortlist.add(slug);
        }
      }
    }
    if (shortlist.size === 0) {
      for (const slug of ontologyIndex.ontology) {
        shortlist.add(slug);
      }
    }

    for (const slug of shortlist) {
      scored.push({
        slug,
        score: scoreSimilarity(candidate, slug),
      });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug));
  return unique(scored.map((row) => row.slug))
    .map((slug) => scored.find((row) => row.slug === slug)!)
    .slice(0, 5);
}

export function canonicalizeIngredientSlug(params: {
  rawSlug: string;
  ontology: Set<string>;
  ontologyIndex?: OntologyIndex;
}): IngredientCanonicalizationDecision {
  const baseSlug = normalizeSlug(params.rawSlug);
  const ruleCandidates = generateDeterministicCandidates(params.rawSlug);
  const ontologyIndex =
    params.ontologyIndex ?? buildOntologyIndex(params.ontology);

  const exact = exactCandidate(ruleCandidates, params.ontology);
  if (exact) {
    return {
      originalSlug: params.rawSlug,
      baseSlug,
      canonicalSlug: exact,
      method: "exact",
      score: 1,
      threshold: 1,
      candidates: [{ slug: exact, score: 1 }],
    };
  }

  const fuzzy = topFuzzyCandidates(ruleCandidates, ontologyIndex);
  const best = fuzzy[0];
  if (best && best.score >= FUZZY_THRESHOLD) {
    const second = fuzzy[1];
    const margin = second ? best.score - second.score : 1;
    if (margin >= FUZZY_MARGIN) {
      return {
        originalSlug: params.rawSlug,
        baseSlug,
        canonicalSlug: best.slug,
        method: "fuzzy",
        score: best.score,
        threshold: FUZZY_THRESHOLD,
        margin,
        candidates: fuzzy,
      };
    }
    return {
      originalSlug: params.rawSlug,
      baseSlug,
      canonicalSlug: baseSlug,
      method: "none",
      reason: "ambiguous",
      score: best.score,
      threshold: FUZZY_THRESHOLD,
      margin,
      candidates: fuzzy,
    };
  }

  return {
    originalSlug: params.rawSlug,
    baseSlug,
    canonicalSlug: baseSlug,
    method: "none",
    reason: fuzzy.length > 0 ? "below-threshold" : "no-candidates",
    score: fuzzy[0]?.score,
    threshold: FUZZY_THRESHOLD,
    margin:
      fuzzy.length > 1 ? fuzzy[0]!.score - fuzzy[1]!.score : undefined,
    candidates: fuzzy,
  };
}

export function canonicalizeRecipeIngredients(
  recipe: Recipe,
  ontology: Set<string>,
): { recipe: Recipe; decisions: IngredientCanonicalizationDecision[] } {
  const decisions: IngredientCanonicalizationDecision[] = [];
  const ontologyIndex = buildOntologyIndex(ontology);

  const canonicalizedRecipe: Recipe = {
    ...recipe,
    ingredientGroups: recipe.ingredientGroups.map((group) => ({
      ...group,
      items: group.items.map((item) => {
        const decision = canonicalizeIngredientSlug({
          rawSlug: item.ingredient,
          ontology,
          ontologyIndex,
        });
        decisions.push(decision);
        return {
          ...item,
          ingredient: decision.canonicalSlug,
        };
      }),
    })),
  };

  return { recipe: canonicalizedRecipe, decisions };
}

function normalizeCuisineLabel(cuisine: string | undefined): string | undefined {
  if (cuisine === undefined) return undefined;
  const trimmed = cuisine.trim();
  if (!trimmed) return undefined;
  if (COMPOUND_CUISINES.has(trimmed.toLowerCase())) {
    return trimmed;
  }

  const firstSegment = trimmed.split("-")[0]?.trim() ?? "";
  return firstSegment || undefined;
}

export function canonicalizePredictionEntry(
  entry: PredictionEntry,
  ontology: Set<string>,
): { entry: PredictionEntry; decisions: IngredientCanonicalizationDecision[] } {
  const canonicalized = canonicalizeRecipeIngredients(entry.predicted, ontology);
  return {
    entry: {
      ...entry,
      predicted: {
        ...canonicalized.recipe,
        cuisine: normalizeCuisineLabel(canonicalized.recipe.cuisine),
      },
    },
    decisions: canonicalized.decisions,
  };
}
