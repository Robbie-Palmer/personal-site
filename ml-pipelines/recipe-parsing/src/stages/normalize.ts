import {
  loadPreparedData,
  loadPredictions,
  NORMALIZATION_DECISIONS_PATH,
  NORMALIZED_PREDICTIONS_PATH,
  writeJson,
} from "../lib/io.js";
import { normalizePredictionEntry } from "../lib/ingredient-normalization.js";

async function main() {
  console.log("Loading predictions and prepared data...");
  const [predictions, prepared] = await Promise.all([
    loadPredictions(),
    loadPreparedData(),
  ]);

  const globalOntology = new Set<string>();
  const localOntologyByKey = new Map<string, Set<string>>();

  for (const entry of prepared.entries) {
    const local = new Set<string>();
    for (const known of entry.knownIngredients ?? []) {
      local.add(known.slug);
      globalOntology.add(known.slug);
    }
    for (const group of entry.expected.ingredientGroups) {
      for (const item of group.items) {
        local.add(item.ingredient);
        globalOntology.add(item.ingredient);
      }
    }
    localOntologyByKey.set(entry.images.join(","), local);
  }

  const normalized = {
    entries: [] as typeof predictions.entries,
  };
  const decisions = {
    generatedAt: new Date().toISOString(),
    entries: [] as Array<{
      images: string[];
      decisions: ReturnType<typeof normalizePredictionEntry>["decisions"];
    }>,
  };

  for (const entry of predictions.entries) {
    const key = entry.images.join(",");
    const localOntology = localOntologyByKey.get(key) ?? new Set<string>();
    const normalizedEntry = normalizePredictionEntry(entry, {
      local: localOntology,
      global: globalOntology,
    });
    normalized.entries.push(normalizedEntry.entry);
    decisions.entries.push({
      images: entry.images,
      decisions: normalizedEntry.decisions,
    });
  }

  await Promise.all([
    writeJson(NORMALIZED_PREDICTIONS_PATH, normalized),
    writeJson(NORMALIZATION_DECISIONS_PATH, decisions),
  ]);
  console.log(
    `Normalized ${normalized.entries.length} entries → ${NORMALIZED_PREDICTIONS_PATH}`,
  );
  console.log(`Normalization decisions written to ${NORMALIZATION_DECISIONS_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
