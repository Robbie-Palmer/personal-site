import { readFileSync, writeFileSync } from "node:fs";
import {
  GroundTruthDatasetSchema,
  PredictionsDatasetSchema,
} from "../schemas/ground-truth";
import { aggregateMetrics } from "../evaluation/metrics";

const PREPARED_PATH = "outputs/prepared.json";
const PREDICTIONS_PATH = "outputs/predictions.json";
const METRICS_PATH = "outputs/metrics.json";
const PER_IMAGE_PATH = "outputs/per-image-scores.json";

async function main() {
  console.log("Loading prepared data and predictions...");

  const prepared = GroundTruthDatasetSchema.parse(
    JSON.parse(readFileSync(PREPARED_PATH, "utf-8")),
  );
  const predictions = PredictionsDatasetSchema.parse(
    JSON.parse(readFileSync(PREDICTIONS_PATH, "utf-8")),
  );

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

  writeFileSync(METRICS_PATH, JSON.stringify(metrics, null, 2));
  writeFileSync(PER_IMAGE_PATH, JSON.stringify(perEntry, null, 2));

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
  console.log(`Per-entry scores written to ${PER_IMAGE_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
