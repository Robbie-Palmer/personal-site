import {
  loadPreparedData,
  loadPredictions,
  writeJson,
  METRICS_PATH,
  PER_IMAGE_SCORES_PATH,
} from "../lib/io";
import { aggregateMetrics } from "../evaluation/metrics";

async function main() {
  console.log("Loading prepared data and predictions...");

  const prepared = await loadPreparedData();
  const predictions = await loadPredictions();

  if (predictions.entries.length !== prepared.entries.length) {
    throw new Error(
      `Entry count mismatch: ground truth has ${prepared.entries.length}, predictions has ${predictions.entries.length}`,
    );
  }

  for (let i = 0; i < prepared.entries.length; i++) {
    const gtKey = prepared.entries[i]!.images.join(",");
    const predKey = predictions.entries[i]!.images.join(",");
    if (gtKey !== predKey) {
      throw new Error(
        `Image mismatch at entry ${i}: expected [${gtKey}], got [${predKey}]`,
      );
    }
  }

  console.log(`Evaluating ${predictions.entries.length} entries...`);

  const { metrics, perEntry } = aggregateMetrics(
    predictions.entries,
    prepared.entries,
  );

  await writeJson(METRICS_PATH, metrics);
  await writeJson(PER_IMAGE_SCORES_PATH, perEntry);

  console.log(`\nResults (${metrics.entryCount} entries):`);
  console.log(`  Overall Score:           ${metrics.overall.score.toFixed(3)}`);
  console.log(
    `  Ingredient Parsing F1:   ${metrics.byCategory.ingredientParsing.f1.toFixed(3)}`,
  );
  console.log(
    `  Ingredient Categories:   ${metrics.byCategory.ingredientCategorization.accuracy.toFixed(3)}`,
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
