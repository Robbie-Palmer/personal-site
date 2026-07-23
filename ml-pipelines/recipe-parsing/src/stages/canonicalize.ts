import {
  loadPredictions,
  loadParams,
  CANONICALIZATION_DECISIONS_PATH,
  CANONICALIZED_PREDICTIONS_PATH,
  writeJson,
  type CanonicalizationParams,
} from "../lib/io.js";
import { canonicalIngredients } from "recipe-parsing/canonical-ingredients-data";
import { canonicalEquipment } from "recipe-parsing/canonical-equipment-data";
import {
  canonicalizePredictionEntry,
  type IngredientCanonicalizationDecision,
} from "recipe-parsing/ingredient-canonicalization";
import type { EquipmentCanonicalizationDecision } from "recipe-parsing/equipment-canonicalization";
import { buildOntology, buildOntologyIndex } from "recipe-parsing/slug-matching";
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
} from "recipe-parsing/openrouter";
import { computeBackoffDelayMs, sleep } from "recipe-parsing/attempts";
import { requiredEnv } from "../lib/env.js";
import type { PredictionEntry } from "recipe-parsing/schemas/ground-truth";

function hasApiKey(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

async function callWithRetries(
  label: string,
  params: CanonicalizationParams,
  call: () => Promise<{ value: DisambiguationChoice[] }>,
): Promise<DisambiguationChoice[] | undefined> {
  for (let attempt = 0; attempt <= params.max_retries; attempt++) {
    try {
      return (await call()).value;
    } catch (err) {
      const isLastAttempt = attempt === params.max_retries;
      if (isLastAttempt) {
        console.warn(
          `  LLM disambiguation failed for ${label} after ${attempt + 1} attempt(s): ${err instanceof Error ? err.message : String(err)}`,
        );
        return undefined;
      }
      const delay = computeBackoffDelayMs(
        attempt,
        params.retry_base_delay_ms,
        params.retry_max_delay_ms,
      );
      console.warn(
        `  LLM attempt ${attempt + 1} failed, retrying in ${delay}ms...`,
      );
      await sleep(delay);
    }
  }
  return undefined;
}

async function runIngredientDisambiguation(
  apiKey: string,
  entry: PredictionEntry,
  decisions: IngredientCanonicalizationDecision[],
  categoryMap: Map<string, string>,
  params: CanonicalizationParams,
): Promise<void> {
  const unresolved = collectUnresolved(decisions, categoryMap);
  if (unresolved.length === 0) return;

  const choices = await callWithRetries(
    `ingredients in "${entry.predicted.title}"`,
    params,
    () =>
      disambiguateIngredients({
        apiKey,
        unresolvedItems: unresolved,
        recipeContext: extractRecipeContext(entry, decisions),
        model: params.model,
        requestTimeoutMs: params.request_timeout_ms,
      }),
  );
  if (!choices) return;

  applyDisambiguationChoices(decisions, unresolved, choices);
}

async function runEquipmentDisambiguation(
  apiKey: string,
  entry: PredictionEntry,
  decisions: EquipmentCanonicalizationDecision[],
  categoryMap: Map<string, string>,
  params: CanonicalizationParams,
): Promise<void> {
  const unresolved = collectUnresolved(decisions, categoryMap);
  if (unresolved.length === 0) return;

  const choices = await callWithRetries(
    `equipment in "${entry.predicted.title}"`,
    params,
    () =>
      disambiguateEquipment({
        apiKey,
        unresolvedItems: unresolved,
        equipmentContext: extractEquipmentContext(entry, decisions),
        model: params.model,
        requestTimeoutMs: params.request_timeout_ms,
      }),
  );
  if (!choices) return;

  applyDisambiguationChoices(decisions, unresolved, choices);
}

function countUnresolved(
  decisions: Array<{ method: string; candidates: unknown[] }>,
): number {
  return decisions.filter((d) => d.method === "none" && d.candidates.length > 0)
    .length;
}

function countResolvedByLlm(decisions: Array<{ method: string }>): number {
  return decisions.filter((d) => d.method === "llm").length;
}

async function main() {
  console.log("Loading predictions and canonical registries...");
  const [predictions, pipelineParams] = await Promise.all([
    loadPredictions(),
    loadParams(),
  ]);

  const ingredientOntology = buildOntology(
    canonicalIngredients.ingredients,
    "ingredient",
  );
  const equipmentOntology = buildOntology(
    canonicalEquipment.equipment,
    "equipment",
  );
  console.log(
    `Canonical registries: ${ingredientOntology.size} ingredients, ${equipmentOntology.size} equipment`,
  );

  const ontologies = {
    ingredients: ingredientOntology,
    ingredientIndex: buildOntologyIndex(ingredientOntology),
    equipment: equipmentOntology,
    equipmentIndex: buildOntologyIndex(equipmentOntology),
  };
  const ingredientCategories = buildCategoryMap(canonicalIngredients.ingredients);
  const equipmentCategories = buildCategoryMap(canonicalEquipment.equipment);
  const canonicalizeParams = pipelineParams.canonicalize;
  const llmEnabled = Boolean(canonicalizeParams) && hasApiKey();

  if (!hasApiKey()) {
    console.log("No OPENROUTER_API_KEY set — skipping LLM disambiguation");
  } else if (!canonicalizeParams) {
    console.log("No canonicalize params in params.yaml — skipping LLM disambiguation");
  } else {
    console.log(`LLM disambiguation enabled (model: ${canonicalizeParams.model})`);
  }

  const canonicalized = {
    entries: [] as typeof predictions.entries,
  };
  const decisions = {
    entries: [] as Array<{
      images: string[];
      decisions: IngredientCanonicalizationDecision[];
      cookwareDecisions: EquipmentCanonicalizationDecision[];
    }>,
  };

  // Pass 1: Deterministic canonicalization
  console.log("Pass 1: Deterministic canonicalization...");
  const allEntryDecisions: IngredientCanonicalizationDecision[][] = [];
  const allEntryCookwareDecisions: EquipmentCanonicalizationDecision[][] = [];

  for (const entry of predictions.entries) {
    const result = canonicalizePredictionEntry(entry, ontologies);
    canonicalized.entries.push(result.entry);
    allEntryDecisions.push(result.decisions);
    allEntryCookwareDecisions.push(result.cookwareDecisions);
    decisions.entries.push({
      images: entry.images,
      decisions: result.decisions,
      cookwareDecisions: result.cookwareDecisions,
    });
  }

  // Pass 2: LLM disambiguation for unresolved ingredients and equipment
  if (llmEnabled) {
    const apiKey = requiredEnv("OPENROUTER_API_KEY");
    const unresolvedIngredients = allEntryDecisions.reduce(
      (sum, d) => sum + countUnresolved(d),
      0,
    );
    const unresolvedEquipment = allEntryCookwareDecisions.reduce(
      (sum, d) => sum + countUnresolved(d),
      0,
    );
    console.log(
      `Pass 2: LLM disambiguation for ${unresolvedIngredients} unresolved ingredient(s) and ${unresolvedEquipment} unresolved equipment item(s)...`,
    );

    for (let i = 0; i < predictions.entries.length; i++) {
      const entry = predictions.entries[i]!;
      const entryDecisions = allEntryDecisions[i]!;
      const entryCookwareDecisions = allEntryCookwareDecisions[i]!;

      const entryUnresolvedIngredients = countUnresolved(entryDecisions);
      const entryUnresolvedEquipment = countUnresolved(entryCookwareDecisions);
      if (entryUnresolvedIngredients === 0 && entryUnresolvedEquipment === 0) {
        continue;
      }

      console.log(
        `  Processing "${entry.predicted.title}" (${entryUnresolvedIngredients} ingredient(s), ${entryUnresolvedEquipment} equipment item(s) unresolved)...`,
      );

      if (entryUnresolvedIngredients > 0) {
        await runIngredientDisambiguation(
          apiKey,
          entry,
          entryDecisions,
          ingredientCategories,
          canonicalizeParams!,
        );
      }
      if (entryUnresolvedEquipment > 0) {
        await runEquipmentDisambiguation(
          apiKey,
          entry,
          entryCookwareDecisions,
          equipmentCategories,
          canonicalizeParams!,
        );
      }

      // Apply LLM decisions back to the canonicalized entry
      canonicalized.entries[i] = applyEquipmentDecisionsToEntry(
        applyLlmDecisionsToEntry(canonicalized.entries[i]!, entryDecisions),
        entryCookwareDecisions,
      );
    }

    const resolvedIngredients = allEntryDecisions.reduce(
      (sum, d) => sum + countResolvedByLlm(d),
      0,
    );
    const resolvedEquipment = allEntryCookwareDecisions.reduce(
      (sum, d) => sum + countResolvedByLlm(d),
      0,
    );
    console.log(
      `LLM resolved ${resolvedIngredients} of ${unresolvedIngredients} ingredient(s) and ${resolvedEquipment} of ${unresolvedEquipment} equipment item(s)`,
    );
  }

  await Promise.all([
    writeJson(CANONICALIZED_PREDICTIONS_PATH, canonicalized),
    writeJson(CANONICALIZATION_DECISIONS_PATH, decisions),
  ]);
  console.log(
    `Canonicalized ${canonicalized.entries.length} entries → ${CANONICALIZED_PREDICTIONS_PATH}`,
  );
  console.log(`Canonicalization decisions written to ${CANONICALIZATION_DECISIONS_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
