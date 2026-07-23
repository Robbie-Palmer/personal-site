import { normalizeSlug } from "recipe-domain/slugs";
import {
  pluralizeIngredientTerm,
  singularizeIngredientTerm,
} from "recipe-domain/pluralization";
import type { PredictionEntry, Recipe } from "../schemas/ground-truth.js";
import {
  applyIngredientTokenFixups,
  EXACT_ALIASES,
} from "./ingredient-normalization-rules.js";
import { normalizeCuisineLabels } from "./cuisine-normalization.js";
import {
  canonicalizeCookwareList,
  type EquipmentCanonicalizationDecision,
} from "./equipment-canonicalization.js";
import {
  buildOntologyIndex,
  detokenize,
  matchSlug,
  tokenize,
  uniqueSlugs,
  type CandidateScore,
  type CanonicalizationMethod,
  type CanonicalizationReason,
  type OntologyIndex,
} from "./slug-matching.js";

export interface IngredientCanonicalizationDecision {
  originalSlug: string;
  baseSlug: string;
  canonicalSlug: string;
  method: CanonicalizationMethod;
  reason?: CanonicalizationReason;
  score?: number;
  threshold?: number;
  margin?: number;
  candidates: CandidateScore[];
}

export interface EntryCanonicalizationDecisions {
  images: string[];
  decisions: IngredientCanonicalizationDecision[];
  cookwareDecisions?: EquipmentCanonicalizationDecision[];
}

export interface CanonicalizationOntologies {
  ingredients: Set<string>;
  ingredientIndex?: OntologyIndex;
  equipment: Set<string>;
  equipmentIndex?: OntologyIndex;
}

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
  "small",
  "fat",
]);

const NOISE_TOKENS = new Set([
  "of",
  "slice",
  "slices",
  "cooked",
]);

export function normalizeIngredientSlug(slug: string): string {
  return normalizeSlug(slug);
}

function generateDeterministicCandidates(base: string): string[] {
  const out = new Set<string>([base]);
  const tokens = tokenize(base);

  const fixedTokens = applyIngredientTokenFixups(tokens);
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

  for (const candidate of [...out]) {
    if (candidate.endsWith("-cheese")) {
      out.add(candidate.replace(/-cheese$/, ""));
    }
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

  return uniqueSlugs([...out]);
}

export function canonicalizeIngredientSlug(params: {
  rawSlug: string;
  ontology: Set<string>;
  ontologyIndex?: OntologyIndex;
}): IngredientCanonicalizationDecision {
  const baseSlug = normalizeSlug(params.rawSlug);
  const match = matchSlug({
    baseSlug,
    candidateSlugs: generateDeterministicCandidates(baseSlug),
    ontology: params.ontology,
    ontologyIndex: params.ontologyIndex,
  });

  return { originalSlug: params.rawSlug, ...match };
}

export function canonicalizeRecipeIngredients(
  recipe: Recipe,
  ontology: Set<string>,
  ontologyIndex?: OntologyIndex,
): { recipe: Recipe; decisions: IngredientCanonicalizationDecision[] } {
  const decisions: IngredientCanonicalizationDecision[] = [];
  const index = ontologyIndex ?? buildOntologyIndex(ontology);

  const canonicalizedRecipe: Recipe = {
    ...recipe,
    ingredientGroups: recipe.ingredientGroups.map((group) => ({
      ...group,
      items: group.items.map((item) => {
        const decision = canonicalizeIngredientSlug({
          rawSlug: item.ingredient,
          ontology,
          ontologyIndex: index,
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

export function canonicalizePredictionEntry(
  entry: PredictionEntry,
  ontologies: CanonicalizationOntologies,
): {
  entry: PredictionEntry;
  decisions: IngredientCanonicalizationDecision[];
  cookwareDecisions: EquipmentCanonicalizationDecision[];
} {
  const canonicalized = canonicalizeRecipeIngredients(
    entry.predicted,
    ontologies.ingredients,
    ontologies.ingredientIndex,
  );
  const canonicalizedCookware = canonicalizeCookwareList(
    canonicalized.recipe.cookware,
    ontologies.equipment,
    ontologies.equipmentIndex,
  );
  return {
    entry: {
      ...entry,
      predicted: {
        ...canonicalized.recipe,
        cuisine: normalizeCuisineLabels(canonicalized.recipe.cuisine),
        cookware: canonicalizedCookware.cookware,
      },
    },
    decisions: canonicalized.decisions,
    cookwareDecisions: canonicalizedCookware.decisions,
  };
}
