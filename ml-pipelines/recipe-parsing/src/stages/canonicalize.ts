import {
  loadCanonicalIngredients,
  loadPredictions,
  loadParams,
  CANONICALIZATION_DECISIONS_PATH,
  CANONICALIZED_PREDICTIONS_PATH,
  writeJson,
  type CanonicalizationParams,
} from "../lib/io.js";
import {
  canonicalizePredictionEntry,
  buildOntologyIndex,
  type IngredientCanonicalizationDecision,
} from "../lib/ingredient-canonicalization.js";
import {
  disambiguateIngredients,
  type UnresolvedItem,
} from "../lib/openrouter.js";
import { computeBackoffDelayMs, sleep } from "../lib/stage-runner.js";
import type { CanonicalIngredient } from "../schemas/canonical-ingredients.js";
import type { PredictionEntry } from "../schemas/ground-truth.js";

function hasApiKey(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

function buildCategoryMap(
  ingredients: CanonicalIngredient[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const { slug, category } of ingredients) {
    map.set(slug, category);
  }
  return map;
}

function collectUnresolved(
  decisions: IngredientCanonicalizationDecision[],
  categoryMap: Map<string, string>,
): UnresolvedItem[] {
  const seen = new Set<string>();
  const items: UnresolvedItem[] = [];
  for (const d of decisions) {
    if (d.method !== "none" || d.candidates.length === 0) continue;
    if (seen.has(d.baseSlug)) continue;
    seen.add(d.baseSlug);
    items.push({
      slug: d.baseSlug,
      candidates: d.candidates.map((c) => ({
        slug: c.slug,
        category: categoryMap.get(c.slug) ?? "other",
      })),
    });
  }
  return items;
}

function extractRecipeContext(
  entry: PredictionEntry,
  decisions: IngredientCanonicalizationDecision[],
): { title: string; cuisine: string[]; otherIngredients: string[] } {
  const resolved = decisions
    .filter((d) => d.method !== "none")
    .map((d) => d.canonicalSlug);
  return {
    title: entry.predicted.title,
    cuisine: entry.predicted.cuisine,
    otherIngredients: [...new Set(resolved)],
  };
}

async function runLlmDisambiguation(
  entry: PredictionEntry,
  decisions: IngredientCanonicalizationDecision[],
  categoryMap: Map<string, string>,
  params: CanonicalizationParams,
): Promise<void> {
  const unresolved = collectUnresolved(decisions, categoryMap);
  if (unresolved.length === 0) return;

  const recipeContext = extractRecipeContext(entry, decisions);

  const validCandidateSlugs = new Map<string, Set<string>>();
  for (const item of unresolved) {
    validCandidateSlugs.set(
      item.slug,
      new Set(item.candidates.map((c) => c.slug)),
    );
  }

  let choices: Awaited<ReturnType<typeof disambiguateIngredients>> | undefined;

  for (let attempt = 0; attempt <= params.max_retries; attempt++) {
    try {
      choices = await disambiguateIngredients({
        unresolvedItems: unresolved,
        recipeContext,
        model: params.model,
        requestTimeoutMs: params.request_timeout_ms,
      });
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

  for (const choice of choices) {
    const allowed = validCandidateSlugs.get(choice.slug);
    if (!allowed) {
      console.warn(
        `  LLM returned unknown ingredient slug "${choice.slug}", skipping`,
      );
      continue;
    }
    if (!allowed.has(choice.canonicalSlug)) {
      console.warn(
        `  LLM returned "${choice.canonicalSlug}" for "${choice.slug}" which is not in the candidate list, skipping`,
      );
      continue;
    }

    for (const d of decisions) {
      if (d.method === "none" && d.baseSlug === choice.slug) {
        d.canonicalSlug = choice.canonicalSlug;
        (d as IngredientCanonicalizationDecision).method = "llm";
        d.reason = undefined;
        console.log(
          `  LLM: "${choice.slug}" → ${choice.canonicalSlug} (${choice.confidence})`,
        );
      }
    }
  }
}

function applyLlmDecisionsToEntry(
  entry: PredictionEntry,
  decisions: IngredientCanonicalizationDecision[],
): PredictionEntry {
  const decisionByOriginal = new Map<string, string>();
  for (const d of decisions) {
    if (d.method === "llm") {
      decisionByOriginal.set(d.originalSlug, d.canonicalSlug);
    }
  }

  if (decisionByOriginal.size === 0) return entry;

  return {
    ...entry,
    predicted: {
      ...entry.predicted,
      ingredientGroups: entry.predicted.ingredientGroups.map((group) => ({
        ...group,
        items: group.items.map((item) => {
          const resolved = decisionByOriginal.get(item.ingredient) ??
            decisionByOriginal.get(
              decisions.find(
                (d) => d.method === "llm" && d.baseSlug === item.ingredient,
              )?.originalSlug ?? "",
            );
          return resolved ? { ...item, ingredient: resolved } : item;
        }),
      })),
    },
  };
}

async function main() {
  console.log("Loading predictions and canonical ingredients...");
  const [predictions, canonicalData, pipelineParams] = await Promise.all([
    loadPredictions(),
    loadCanonicalIngredients(),
    loadParams(),
  ]);

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
