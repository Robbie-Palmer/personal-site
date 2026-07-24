export type CanonicalizationMethod = "exact" | "fuzzy" | "llm" | "none";

export type CanonicalizationReason =
  | "below-threshold"
  | "ambiguous"
  | "no-candidates";

export interface CandidateScore {
  slug: string;
  score: number;
}

export interface OntologyIndex {
  ontology: Set<string>;
  byToken: Map<string, Set<string>>;
}

export interface SlugMatch {
  baseSlug: string;
  canonicalSlug: string;
  method: CanonicalizationMethod;
  reason?: CanonicalizationReason;
  score?: number;
  threshold?: number;
  margin?: number;
  candidates: CandidateScore[];
}

const FUZZY_THRESHOLD = 0.85;
const FUZZY_MARGIN = 0.04;
const MAX_CANDIDATES = 5;

export function tokenize(slug: string): string[] {
  return slug.split("-").filter(Boolean);
}

export function detokenize(tokens: string[]): string {
  return tokens.join("-");
}

export function uniqueSlugs(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

export function buildOntology(
  entries: Array<{ slug: string }>,
  label: string,
): Set<string> {
  const ontology = new Set<string>();
  for (const { slug } of entries) {
    if (ontology.has(slug)) {
      throw new Error(`Duplicate canonical ${label} slug: ${slug}`);
    }
    ontology.add(slug);
  }
  return ontology;
}

export function buildOntologyIndex(ontology: Set<string>): OntologyIndex {
  const byToken = new Map<string, Set<string>>();
  for (const slug of ontology) {
    for (const token of tokenize(slug)) {
      const slugs = byToken.get(token) ?? new Set<string>();
      slugs.add(slug);
      byToken.set(token, slugs);
    }
  }
  return { ontology, byToken };
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

/**
 * Only slugs sharing a token are worth scoring. Without one the token score is
 * 0, capping similarity at 0.4 — below any usable threshold — so a wider
 * shortlist cannot produce a match, it can only put unrelated slugs in front
 * of the LLM as if they were plausible.
 */
function shortlistFor(
  candidate: string,
  ontologyIndex: OntologyIndex,
): Iterable<string> {
  const shortlist = new Set<string>();
  for (const token of tokenize(candidate)) {
    for (const slug of ontologyIndex.byToken.get(token) ?? []) {
      shortlist.add(slug);
    }
  }
  return shortlist;
}

function highestScoringUnique(scored: CandidateScore[]): CandidateScore[] {
  scored.sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug));

  const seen = new Set<string>();
  const result: CandidateScore[] = [];
  for (const row of scored) {
    if (seen.has(row.slug)) continue;
    seen.add(row.slug);
    result.push(row);
    if (result.length === MAX_CANDIDATES) break;
  }
  return result;
}

function topFuzzyCandidates(
  candidates: string[],
  ontologyIndex: OntologyIndex,
): CandidateScore[] {
  if (ontologyIndex.ontology.size === 0 || candidates.length === 0) {
    return [];
  }

  const scored = candidates.flatMap((candidate) =>
    [...shortlistFor(candidate, ontologyIndex)].map((slug) => ({
      slug,
      score: scoreSimilarity(candidate, slug),
    })),
  );

  return highestScoringUnique(scored);
}

/**
 * Resolve a raw slug against an ontology: exact hit on any rule-generated
 * candidate wins, otherwise the best fuzzy match is accepted when it clears
 * both the score threshold and the margin over the runner-up.
 */
export function matchSlug(params: {
  baseSlug: string;
  candidateSlugs: string[];
  ontology: Set<string>;
  ontologyIndex?: OntologyIndex;
  fuzzyThreshold?: number;
  fuzzyMargin?: number;
}): SlugMatch {
  const threshold = params.fuzzyThreshold ?? FUZZY_THRESHOLD;
  const requiredMargin = params.fuzzyMargin ?? FUZZY_MARGIN;
  const ontologyIndex =
    params.ontologyIndex ?? buildOntologyIndex(params.ontology);

  const exact = exactCandidate(params.candidateSlugs, params.ontology);
  if (exact) {
    return {
      baseSlug: params.baseSlug,
      canonicalSlug: exact,
      method: "exact",
      score: 1,
      threshold: 1,
      candidates: [{ slug: exact, score: 1 }],
    };
  }

  const fuzzy = topFuzzyCandidates(params.candidateSlugs, ontologyIndex);
  const best = fuzzy[0];
  if (best && best.score >= threshold) {
    const second = fuzzy[1];
    const margin = second ? best.score - second.score : 1;
    if (margin >= requiredMargin) {
      return {
        baseSlug: params.baseSlug,
        canonicalSlug: best.slug,
        method: "fuzzy",
        score: best.score,
        threshold,
        margin,
        candidates: fuzzy,
      };
    }
    return {
      baseSlug: params.baseSlug,
      canonicalSlug: params.baseSlug,
      method: "none",
      reason: "ambiguous",
      score: best.score,
      threshold,
      margin,
      candidates: fuzzy,
    };
  }

  return {
    baseSlug: params.baseSlug,
    canonicalSlug: params.baseSlug,
    method: "none",
    reason: fuzzy.length > 0 ? "below-threshold" : "no-candidates",
    score: fuzzy[0]?.score,
    threshold,
    margin: fuzzy.length > 1 ? fuzzy[0]!.score - fuzzy[1]!.score : undefined,
    candidates: fuzzy,
  };
}
