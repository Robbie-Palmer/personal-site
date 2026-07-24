import {
  canonicalizePredictionEntry,
  type CanonicalizationOntologies,
  type IngredientCanonicalizationDecision,
} from "recipe-parsing/ingredient-canonicalization";
import type { EquipmentCanonicalizationDecision } from "recipe-parsing/equipment-canonicalization";
import {
  applyDisambiguationChoices,
  applyEquipmentDecisionsToEntry,
  applyLlmDecisionsToEntry,
  buildCategoryMap,
  collectUnresolved,
  extractEquipmentContext,
  extractRecipeContext,
} from "recipe-parsing/disambiguation";
import {
  disambiguateEquipment,
  disambiguateIngredients,
  type DisambiguationChoice,
  type EquipmentContext,
  type RecipeContext,
  type UnresolvedItem,
} from "recipe-parsing/openrouter";
import { computeBackoffDelayMs, sleep } from "recipe-parsing/attempts";
import { canonicalIngredients } from "recipe-parsing/canonical-ingredients-data";
import { canonicalEquipment } from "recipe-parsing/canonical-equipment-data";
import { buildOntology, buildOntologyIndex } from "recipe-parsing/slug-matching";
import type {
  PredictionEntry,
  PredictionsDataset,
} from "recipe-parsing/schemas/ground-truth";
import type { CanonicalizationParams } from "./io.js";

export interface EntryCanonicalization {
  entry: PredictionEntry;
  decisions: IngredientCanonicalizationDecision[];
  cookwareDecisions: EquipmentCanonicalizationDecision[];
}

export interface RetryPolicy {
  max_retries: number;
  retry_base_delay_ms: number;
  retry_max_delay_ms: number;
}

export type IngredientResolver = (params: {
  entry: PredictionEntry;
  unresolvedItems: UnresolvedItem[];
  recipeContext: RecipeContext;
}) => Promise<DisambiguationChoice[] | undefined>;

export type EquipmentResolver = (params: {
  entry: PredictionEntry;
  unresolvedItems: UnresolvedItem[];
  equipmentContext: EquipmentContext;
}) => Promise<DisambiguationChoice[] | undefined>;

interface DisambiguationSetup {
  ingredientCategories: Map<string, string>;
  equipmentCategories: Map<string, string>;
  resolveIngredients: IngredientResolver;
  resolveEquipment: EquipmentResolver;
}

export function canonicalizeEntry(
  entry: PredictionEntry,
  ontologies: CanonicalizationOntologies,
): EntryCanonicalization {
  const result = canonicalizePredictionEntry(entry, ontologies);
  return {
    entry: result.entry,
    decisions: result.decisions,
    cookwareDecisions: result.cookwareDecisions,
  };
}

export function countUnresolved(
  decisions: Array<{ method: string; candidates: unknown[] }>,
): number {
  return decisions.filter((d) => d.method === "none" && d.candidates.length > 0)
    .length;
}

export function countResolvedByLlm(
  decisions: Array<{ method: string }>,
): number {
  return decisions.filter((d) => d.method === "llm").length;
}

export async function withRetries<T>(
  label: string,
  policy: RetryPolicy,
  call: () => Promise<T>,
): Promise<T | undefined> {
  for (let attempt = 0; attempt <= policy.max_retries; attempt++) {
    try {
      return await call();
    } catch (err) {
      if (attempt === policy.max_retries) {
        console.warn(
          `  LLM disambiguation failed for ${label} after ${attempt + 1} attempt(s): ${err instanceof Error ? err.message : String(err)}`,
        );
        return undefined;
      }
      const delay = computeBackoffDelayMs(
        attempt,
        policy.retry_base_delay_ms,
        policy.retry_max_delay_ms,
      );
      console.warn(
        `  LLM attempt ${attempt + 1} failed, retrying in ${delay}ms...`,
      );
      await sleep(delay);
    }
  }
  return undefined;
}

/**
 * Hand each registry's unresolved items to its resolver and fold the accepted
 * choices back into both the decisions and the canonicalized entry.
 */
export async function disambiguateEntry(
  canonicalization: EntryCanonicalization,
  params: DisambiguationSetup,
): Promise<EntryCanonicalization> {
  const { entry, decisions, cookwareDecisions } = canonicalization;

  const unresolvedIngredients = collectUnresolved(
    decisions,
    params.ingredientCategories,
  );
  if (unresolvedIngredients.length > 0) {
    const choices = await params.resolveIngredients({
      entry,
      unresolvedItems: unresolvedIngredients,
      recipeContext: extractRecipeContext(entry, decisions),
    });
    if (choices) {
      applyDisambiguationChoices(decisions, unresolvedIngredients, choices);
    }
  }

  const unresolvedEquipment = collectUnresolved(
    cookwareDecisions,
    params.equipmentCategories,
  );
  if (unresolvedEquipment.length > 0) {
    const choices = await params.resolveEquipment({
      entry,
      unresolvedItems: unresolvedEquipment,
      equipmentContext: extractEquipmentContext(entry, cookwareDecisions),
    });
    if (choices) {
      applyDisambiguationChoices(
        cookwareDecisions,
        unresolvedEquipment,
        choices,
      );
    }
  }

  return {
    entry: applyEquipmentDecisionsToEntry(
      applyLlmDecisionsToEntry(entry, decisions),
      cookwareDecisions,
    ),
    decisions,
    cookwareDecisions,
  };
}

function sum(counts: number[]): number {
  return counts.reduce((total, count) => total + count, 0);
}

export async function disambiguateEntries(
  entries: EntryCanonicalization[],
  params: DisambiguationSetup,
): Promise<EntryCanonicalization[]> {
  const unresolvedIngredients = sum(
    entries.map((c) => countUnresolved(c.decisions)),
  );
  const unresolvedEquipment = sum(
    entries.map((c) => countUnresolved(c.cookwareDecisions)),
  );
  console.log(
    `Pass 2: LLM disambiguation for ${unresolvedIngredients} unresolved ingredient(s) and ${unresolvedEquipment} unresolved equipment item(s)...`,
  );

  const results: EntryCanonicalization[] = [];
  for (const canonicalization of entries) {
    const entryIngredients = countUnresolved(canonicalization.decisions);
    const entryEquipment = countUnresolved(canonicalization.cookwareDecisions);
    if (entryIngredients === 0 && entryEquipment === 0) {
      results.push(canonicalization);
      continue;
    }

    console.log(
      `  Processing "${canonicalization.entry.predicted.title}" (${entryIngredients} ingredient(s), ${entryEquipment} equipment item(s) unresolved)...`,
    );
    results.push(await disambiguateEntry(canonicalization, params));
  }

  const resolvedIngredients = sum(
    results.map((c) => countResolvedByLlm(c.decisions)),
  );
  const resolvedEquipment = sum(
    results.map((c) => countResolvedByLlm(c.cookwareDecisions)),
  );
  console.log(
    `LLM resolved ${resolvedIngredients} of ${unresolvedIngredients} ingredient(s) and ${resolvedEquipment} of ${unresolvedEquipment} equipment item(s)`,
  );

  return results;
}

function llmResolvers(
  apiKey: string,
  params: CanonicalizationParams,
): DisambiguationSetup {
  const call = async <T>(
    label: string,
    request: () => Promise<{ value: T }>,
  ): Promise<T | undefined> => (await withRetries(label, params, request))?.value;

  return {
    ingredientCategories: buildCategoryMap(canonicalIngredients.ingredients),
    equipmentCategories: buildCategoryMap(canonicalEquipment.equipment),
    resolveIngredients: ({ entry, ...args }) =>
      call(`ingredients in "${entry.predicted.title}"`, () =>
        disambiguateIngredients({
          apiKey,
          ...args,
          model: params.model,
          requestTimeoutMs: params.request_timeout_ms,
        }),
      ),
    resolveEquipment: ({ entry, ...args }) =>
      call(`equipment in "${entry.predicted.title}"`, () =>
        disambiguateEquipment({
          apiKey,
          ...args,
          model: params.model,
          requestTimeoutMs: params.request_timeout_ms,
        }),
      ),
  };
}

export async function canonicalizePredictions(params: {
  predictions: PredictionsDataset;
  canonicalizeParams?: CanonicalizationParams;
  apiKey?: string;
}): Promise<{
  canonicalized: { entries: PredictionEntry[] };
  decisions: {
    entries: Array<{
      images: string[];
      decisions: IngredientCanonicalizationDecision[];
      cookwareDecisions: EquipmentCanonicalizationDecision[];
    }>;
  };
}> {
  const ingredients = buildOntology(
    canonicalIngredients.ingredients,
    "ingredient",
  );
  const equipment = buildOntology(canonicalEquipment.equipment, "equipment");
  console.log(
    `Canonical registries: ${ingredients.size} ingredients, ${equipment.size} equipment`,
  );

  console.log("Pass 1: Deterministic canonicalization...");
  const ontologies = {
    ingredients,
    ingredientIndex: buildOntologyIndex(ingredients),
    equipment,
    equipmentIndex: buildOntologyIndex(equipment),
  };
  let canonicalized = params.predictions.entries.map((entry) =>
    canonicalizeEntry(entry, ontologies),
  );

  if (!params.apiKey) {
    console.log("No OPENROUTER_API_KEY set — skipping LLM disambiguation");
  } else if (!params.canonicalizeParams) {
    console.log(
      "No canonicalize params in params.yaml — skipping LLM disambiguation",
    );
  } else {
    console.log(
      `LLM disambiguation enabled (model: ${params.canonicalizeParams.model})`,
    );
    canonicalized = await disambiguateEntries(
      canonicalized,
      llmResolvers(params.apiKey, params.canonicalizeParams),
    );
  }

  return {
    canonicalized: { entries: canonicalized.map((c) => c.entry) },
    decisions: {
      entries: canonicalized.map((c) => ({
        images: c.entry.images,
        decisions: c.decisions,
        cookwareDecisions: c.cookwareDecisions,
      })),
    },
  };
}
