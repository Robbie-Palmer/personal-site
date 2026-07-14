import {
  loadPredictions,
  loadParams,
  CANONICALIZATION_DECISIONS_PATH,
  CANONICALIZED_PREDICTIONS_PATH,
  writeJson,
  type CanonicalizationParams,
} from "../lib/io.js";
import { canonicalIngredients } from "recipe-parsing/canonical-ingredients-data";
import {
  canonicalizePredictionEntry,
  buildOntologyIndex,
  type IngredientCanonicalizationDecision,
} from "recipe-parsing/ingredient-canonicalization";
import {
  applyDisambiguationChoices,
  applyLlmDecisionsToEntry,
  buildCategoryMap,
  collectUnresolved,
  extractRecipeContext,
} from "recipe-parsing/disambiguation";
import {
  disambiguateIngredients,
  type DisambiguationChoice,
} from "recipe-parsing/openrouter";
import { computeBackoffDelayMs, sleep } from "recipe-parsing/attempts";
import { requiredEnv } from "../lib/env.js";
import type { PredictionEntry } from "recipe-parsing/schemas/ground-truth";

function hasApiKey(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

async function runLlmDisambiguation(
  apiKey: string,
  entry: PredictionEntry,
  decisions: IngredientCanonicalizationDecision[],
  categoryMap: Map<string, string>,
  params: CanonicalizationParams,
): Promise<void> {
  const unresolved = collectUnresolved(decisions, categoryMap);
  if (unresolved.length === 0) return;

  const recipeContext = extractRecipeContext(entry, decisions);

  let choices: DisambiguationChoice[] | undefined;

  for (let attempt = 0; attempt <= params.max_retries; attempt++) {
    try {
      choices = (
        await disambiguateIngredients({
          apiKey,
          unresolvedItems: unresolved,
          recipeContext,
          model: params.model,
          requestTimeoutMs: params.request_timeout_ms,
        })
      ).value;
      break;
    } catch (err) {
      const isLastAttempt = attempt === params.max_retries;
      if (isLastAttempt) {
        console.warn(
          `  LLM disambiguation failed for "${entry.predicted.title}" after ${attempt + 1} attempt(s): ${err instanceof Error ? err.message : String(err)}`,
        );
        return;
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

  if (!choices) return;

  applyDisambiguationChoices(decisions, unresolved, choices);
}

async function main() {
  console.log("Loading predictions and canonical ingredients...");
  const [predictions, pipelineParams] = await Promise.all([
    loadPredictions(),
    loadParams(),
  ]);
  const canonicalData = canonicalIngredients;

  const ontology = new Set<string>();
  for (const { slug } of canonicalData.ingredients) {
    if (ontology.has(slug)) {
      throw new Error(`Duplicate canonical ingredient slug: ${slug}`);
    }
    ontology.add(slug);
  }
  console.log(`Canonical ingredient registry: ${ontology.size} ingredients`);

  const ontologyIndex = buildOntologyIndex(ontology);
  const categoryMap = buildCategoryMap(canonicalData.ingredients);
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
      decisions: ReturnType<typeof canonicalizePredictionEntry>["decisions"];
      cookwareDecisions: ReturnType<typeof canonicalizePredictionEntry>["cookwareDecisions"];
    }>,
  };

  // Pass 1: Deterministic canonicalization
  console.log("Pass 1: Deterministic canonicalization...");
  const allEntryDecisions: IngredientCanonicalizationDecision[][] = [];

  for (const entry of predictions.entries) {
    const result = canonicalizePredictionEntry(entry, ontology, ontologyIndex);
    canonicalized.entries.push(result.entry);
    allEntryDecisions.push(result.decisions);
    decisions.entries.push({
      images: entry.images,
      decisions: result.decisions,
      cookwareDecisions: result.cookwareDecisions,
    });
  }

  // Pass 2: LLM disambiguation for unresolved ingredients
  if (llmEnabled) {
    const apiKey = requiredEnv("OPENROUTER_API_KEY");
    const unresolvedCount = allEntryDecisions.reduce(
      (sum, d) => sum + d.filter((x) => x.method === "none" && x.candidates.length > 0).length,
      0,
    );
    console.log(`Pass 2: LLM disambiguation for ${unresolvedCount} unresolved ingredient(s)...`);

    for (let i = 0; i < predictions.entries.length; i++) {
      const entry = predictions.entries[i]!;
      const entryDecisions = allEntryDecisions[i]!;

      const unresolvedInEntry = entryDecisions.filter(
        (d) => d.method === "none" && d.candidates.length > 0,
      );
      if (unresolvedInEntry.length === 0) continue;

      console.log(
        `  Processing "${entry.predicted.title}" (${unresolvedInEntry.length} unresolved)...`,
      );

      await runLlmDisambiguation(
        apiKey,
        entry,
        entryDecisions,
        categoryMap,
        canonicalizeParams!,
      );

      // Apply LLM decisions back to the canonicalized entry
      canonicalized.entries[i] = applyLlmDecisionsToEntry(
        canonicalized.entries[i]!,
        entryDecisions,
      );
    }

    const resolvedByLlm = allEntryDecisions.reduce(
      (sum, d) => sum + d.filter((x) => x.method === "llm").length,
      0,
    );
    console.log(`LLM resolved ${resolvedByLlm} of ${unresolvedCount} ingredient(s)`);
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
