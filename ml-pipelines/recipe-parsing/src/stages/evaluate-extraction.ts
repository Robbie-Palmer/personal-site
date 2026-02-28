import {
  loadPreparedData,
  loadPredictions,
  writeJson,
  EXTRACTION_METRICS_PATH,
  EXTRACTION_PER_IMAGE_SCORES_PATH,
} from "../lib/io";
import { aggregateMetrics } from "../evaluation/metrics";
import { imageSetKey } from "../lib/image-key.js";

async function main() {
  console.log("Loading prepared data and raw predictions...");

  const [prepared, predictions] = await Promise.all([
    loadPreparedData(),
    loadPredictions(),
  ]);

  const entriesWithRawExpected = prepared.entries.filter(
    (entry) => entry.rawExpected !== undefined,
  );

  if (entriesWithRawExpected.length === 0) {
    console.log(
      "No entries have rawExpected annotations yet — skipping extraction evaluation.",
    );
    console.log(
      "Add rawExpected to ground-truth.json entries to enable extraction evaluation.",
    );

    await Promise.all([
      writeJson(EXTRACTION_METRICS_PATH, { skipped: true, reason: "no-raw-expected-annotations" }),
      writeJson(EXTRACTION_PER_IMAGE_SCORES_PATH, []),
    ]);
    return;
  }

  const rawExpectedByKey = new Map(
    entriesWithRawExpected.map((entry) => [
      imageSetKey(entry.images),
      entry,
    ]),
  );

  const matchedPredictions = predictions.entries.filter((entry) =>
    rawExpectedByKey.has(imageSetKey(entry.images)),
  );

  const groundTruthForEval = entriesWithRawExpected.map((entry) => ({
    ...entry,
    expected: entry.rawExpected!,
  }));

  console.log(
    `Evaluating extraction quality: ${groundTruthForEval.length} entries with rawExpected, ` +
      `${matchedPredictions.length} matching predictions...`,
  );

  const { metrics, perEntry } = aggregateMetrics(
    matchedPredictions,
    groundTruthForEval,
  );
  const missingCount = perEntry.filter((entry) => entry.missingPrediction).length;

  await Promise.all([
    writeJson(EXTRACTION_METRICS_PATH, metrics),
    writeJson(EXTRACTION_PER_IMAGE_SCORES_PATH, perEntry),
  ]);

  console.log(`\nExtraction Results (${metrics.entryCount} entries):`);
  console.log(`  Missing Predictions:     ${missingCount}`);
  console.log(`  Overall Score:           ${metrics.overall.score.toFixed(3)}`);
  console.log(
    `  Ingredient Parsing F1:   ${metrics.byCategory.ingredientParsing.f1.toFixed(3)}`,
  );
  console.log(
    `  Instructions F1:         ${metrics.byCategory.instructions.f1.toFixed(3)}`,
  );
  console.log(`\nExtraction metrics written to ${EXTRACTION_METRICS_PATH}`);
  console.log(`Per-entry scores written to ${EXTRACTION_PER_IMAGE_SCORES_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
