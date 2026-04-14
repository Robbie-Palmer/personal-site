import {
  loadPreparedData,
  loadCanonicalizedPredictions,
  writeJson,
  METRICS_PATH,
  PER_ENTRY_SCORE_PLOT_PATH,
  PER_IMAGE_SCORES_PATH,
} from "../lib/io";
import { aggregateMetrics } from "../evaluation/metrics";
import { imageSetKey } from "../lib/image-key.js";

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
  const preparedByImageKey = new Map(
    prepared.entries.map((entry) => [imageSetKey(entry.images), entry]),
  );
  const perEntryPlot = perEntry.map((entry, index) => ({
    step: index,
    recipe_title:
      preparedByImageKey.get(imageSetKey(entry.images))?.expected.title ??
      entry.images.join(", "),
    image_key: entry.images.join(", "),
    image_count: entry.images.length,
    overall_score: entry.scores.overall,
    scalar_fields_score: entry.scores.scalarFields,
    ingredient_parsing_score: entry.scores.ingredientParsing,
    instructions_score: entry.scores.instructions,
    missing_prediction: Boolean(entry.missingPrediction),
  }));

  await Promise.all([
    writeJson(METRICS_PATH, metrics),
    writeJson(PER_IMAGE_SCORES_PATH, perEntry),
    writeJson(PER_ENTRY_SCORE_PLOT_PATH, perEntryPlot),
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
  console.log(`Plot data written to ${PER_ENTRY_SCORE_PLOT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
