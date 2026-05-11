import {
  loadPreparedData,
  loadPredictions,
  writeJson,
  NORMALIZATION_METRICS_PATH,
  NORMALIZATION_PER_IMAGE_SCORES_PATH,
} from "../lib/io";
import { aggregateMetrics } from "../evaluation/metrics";
import { imageSetKey } from "../lib/image-key.js";
import { deriveRecipeFromCooklang } from "../lib/cooklang.js";
import type {
  GroundTruthEntry,
  PredictionEntry,
} from "../schemas/ground-truth.js";
import type { CooklangRecipe } from "../schemas/stage-artifacts.js";

function hasExpectedNormalization(
  entry: GroundTruthEntry,
): entry is GroundTruthEntry & { expectedNormalization: CooklangRecipe } {
  return entry.expectedNormalization !== undefined;
}

async function main() {
  console.log("Loading prepared data and normalization predictions...");

  const [prepared, predictions] = await Promise.all([
    loadPreparedData(),
    loadPredictions(),
  ]);

  const entriesWithNormalization = prepared.entries.filter(hasExpectedNormalization);

  if (entriesWithNormalization.length === 0) {
    console.log(
      "No entries have expectedNormalization annotations yet — skipping normalization evaluation.",
    );
    console.log(
      "Add expectedNormalization to ground-truth.json entries to enable normalization evaluation.",
    );

    await Promise.all([
      writeJson(NORMALIZATION_METRICS_PATH, { skipped: true, reason: "no-expected-normalization-annotations" }),
      writeJson(NORMALIZATION_PER_IMAGE_SCORES_PATH, []),
    ]);
    return;
  }

  const normalizationByKey = new Map(
    entriesWithNormalization.map((entry) => [
      imageSetKey(entry.images),
      entry,
    ]),
  );

  const matchedPredictions: PredictionEntry[] = predictions.entries
    .filter((entry) => normalizationByKey.has(imageSetKey(entry.images)))
    .map((entry) => ({
      images: entry.images,
      predicted: entry.predicted,
    }));

  const groundTruthForEval = entriesWithNormalization.map((entry) => {
    const derived = deriveRecipeFromCooklang(entry.expectedNormalization);
    if (!derived.derived) {
      throw new Error(
        `Failed to derive recipe from expectedNormalization for [${entry.images.join(", ")}]`,
      );
    }
    return {
      images: entry.images,
      expected: derived.derived,
    };
  });

  console.log(
    `Evaluating normalization quality: ${groundTruthForEval.length} entries with expectedNormalization, ` +
      `${matchedPredictions.length} matching predictions...`,
  );

  const { metrics, perEntry } = aggregateMetrics(
    matchedPredictions,
    groundTruthForEval,
  );
  const missingCount = perEntry.filter((entry) => entry.missingPrediction).length;

  await Promise.all([
    writeJson(NORMALIZATION_METRICS_PATH, metrics),
    writeJson(NORMALIZATION_PER_IMAGE_SCORES_PATH, perEntry),
  ]);

  console.log(`\nNormalization Results (${metrics.entryCount} entries):`);
  console.log(`  Missing Predictions:     ${missingCount}`);
  console.log(`  Overall Score:           ${metrics.overall.score.toFixed(3)}`);
  console.log(
    `  Ingredient Parsing F1:   ${metrics.byCategory.ingredientParsing.f1.toFixed(3)}`,
  );
  console.log(
    `  Instructions F1:         ${metrics.byCategory.instructions.f1.toFixed(3)}`,
  );
  console.log(
    `  Equipment F1:            ${metrics.byCategory.equipmentParsing.f1.toFixed(3)}`,
  );
  console.log(
    `  Cuisine F1:              ${metrics.byCategory.scalarFields.cuisine.f1.toFixed(3)}`,
  );
  console.log(
    `  Servings Match:          ${(metrics.byCategory.scalarFields.servings.accuracy * 100).toFixed(1)}%`,
  );
  console.log(`\nNormalization metrics written to ${NORMALIZATION_METRICS_PATH}`);
  console.log(`Per-entry scores written to ${NORMALIZATION_PER_IMAGE_SCORES_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
