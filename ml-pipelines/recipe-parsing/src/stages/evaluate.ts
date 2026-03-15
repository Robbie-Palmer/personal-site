import {
  loadPreparedData,
  loadCanonicalizedPredictions,
  writeJson,
  METRICS_PATH,
  PER_IMAGE_SCORES_PATH,
} from "../lib/io";
import { aggregateMetrics } from "../evaluation/metrics";

async function main() {
  console.log("Loading prepared data and canonicalized predictions...");

  const [prepared, predictions] = await Promise.all([
    loadPreparedData(),
    loadCanonicalizedPredictions(),
  ]);

  console.log(
    `Evaluating ${prepared.entries.length} entries with ${predictions.entries.length} predictions...`,
  );

  const { metrics, perEntry } = aggregateMetrics(
    predictions.entries,
    prepared.entries,
  );
  const missingCount = perEntry.filter((entry) => entry.missingPrediction).length;

  await Promise.all([
    writeJson(METRICS_PATH, metrics),
    writeJson(PER_IMAGE_SCORES_PATH, perEntry),
  ]);

  console.log(`\nResults (${metrics.entryCount} entries):`);
  console.log(`  Missing Predictions:     ${missingCount}`);
  console.log(`  Overall Score:           ${metrics.overall.score.toFixed(3)}`);
  console.log(
    `  Ingredient Parsing F1:   ${metrics.byCategory.ingredientParsing.f1.toFixed(3)}`,
  );
  console.log(
    `  Instructions F1:         ${metrics.byCategory.instructions.f1.toFixed(3)}`,
  );
  console.log(
    `  Cuisine Match:           ${(metrics.byCategory.scalarFields.cuisine.accuracy * 100).toFixed(1)}%`,
  );
  console.log(
    `  Servings Match:          ${(metrics.byCategory.scalarFields.servings.accuracy * 100).toFixed(1)}%`,
  );
  console.log(`\nMetrics written to ${METRICS_PATH}`);
  console.log(`Per-entry scores written to ${PER_IMAGE_SCORES_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
