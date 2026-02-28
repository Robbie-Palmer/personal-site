import {
  loadCanonicalIngredients,
  loadPredictions,
  CANONICALIZATION_DECISIONS_PATH,
  CANONICALIZED_PREDICTIONS_PATH,
  writeJson,
} from "../lib/io.js";
import { canonicalizePredictionEntry } from "../lib/ingredient-canonicalization.js";

async function main() {
  console.log("Loading predictions and canonical ingredients...");
  const [predictions, canonicalData] = await Promise.all([
    loadPredictions(),
    loadCanonicalIngredients(),
  ]);

  const ontology = new Set(canonicalData.ingredients.map((i) => i.slug));
  console.log(`Canonical ingredient registry: ${ontology.size} ingredients`);

  const canonicalized = {
    entries: [] as typeof predictions.entries,
  };
  const decisions = {
    entries: [] as Array<{
      images: string[];
      decisions: ReturnType<typeof canonicalizePredictionEntry>["decisions"];
    }>,
  };

  for (const entry of predictions.entries) {
    const result = canonicalizePredictionEntry(entry, ontology);
    canonicalized.entries.push(result.entry);
    decisions.entries.push({
      images: entry.images,
      decisions: result.decisions,
    });
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
