import {
  loadPreparedData,
  loadExtractionPredictions,
  writeJson,
  EXTRACTION_METRICS_PATH,
  EXTRACTION_PER_IMAGE_SCORES_PATH,
} from "../lib/io";
import {
  aggregateMetrics,
  computeCharErrorRate,
  computeRougeL,
  computeWordErrorRate,
} from "../evaluation/metrics";
import { imageSetKey } from "../lib/image-key.js";
import {
  inferCooklangIngredientLine,
  parseIngredientLine,
  parseScalarTextNumber,
} from "../lib/cooklang.js";
import { flattenExtractionText } from "../lib/extraction-text.js";
import type {
  GroundTruthEntry,
  ExtractionRecipe,
  Recipe,
  PredictionEntry,
} from "../schemas/ground-truth.js";

function hasExpectedExtraction(entry: GroundTruthEntry): entry is GroundTruthEntry & { expectedExtraction: ExtractionRecipe } {
  return entry.expectedExtraction !== undefined;
}

/**
 * Convert a text-based ExtractionRecipe to a full Recipe for aggregateMetrics
 * compatibility. Parses ingredient text lines into structured RecipeIngredient
 * objects via the Cooklang line-inference heuristic. Both prediction and
 * ground-truth sides go through the same conversion so parsing noise is
 * symmetric.
 */
function extractionToRecipe(extraction: ExtractionRecipe): Recipe {
  const ingredientGroups = extraction.ingredientGroups.map((group) => ({
    ...(group.name ? { name: group.name } : {}),
    items: group.lines.flatMap((line) =>
      parseIngredientLine(inferCooklangIngredientLine(line)),
    ),
  }));

  return {
    title: extraction.title,
    description: extraction.description ?? "",
    cuisine: extraction.cuisine ? [extraction.cuisine] : [],
    servings: parseScalarTextNumber(extraction.servings) ?? 0,
    prepTime: parseScalarTextNumber(extraction.prepTime),
    cookTime: parseScalarTextNumber(extraction.cookTime),
    ingredientGroups,
    instructions: extraction.instructions,
    cookware: [],
  };
}

async function main() {
  console.log("Loading prepared data and extraction predictions...");

  const [prepared, extractionPredictions] = await Promise.all([
    loadPreparedData(),
    loadExtractionPredictions(),
  ]);

  const entriesWithExtraction = prepared.entries.filter(hasExpectedExtraction);

  if (entriesWithExtraction.length === 0) {
    console.log(
      "No entries have expectedExtraction annotations yet — skipping extraction evaluation.",
    );
    console.log(
      "Add expectedExtraction to ground-truth.json entries to enable extraction evaluation.",
    );

    await Promise.all([
      writeJson(EXTRACTION_METRICS_PATH, { skipped: true, reason: "no-expected-extraction-annotations" }),
      writeJson(EXTRACTION_PER_IMAGE_SCORES_PATH, []),
    ]);
    return;
  }

  const extractionByKey = new Map(
    entriesWithExtraction.map((entry) => [
      imageSetKey(entry.images),
      entry,
    ]),
  );

  const matchedPredictions: PredictionEntry[] = extractionPredictions.entries
    .filter((entry) => extractionByKey.has(imageSetKey(entry.images)))
    .map((entry) => ({
      images: entry.images,
      predicted: extractionToRecipe(entry.extracted),
    }));

  const groundTruthForEval = entriesWithExtraction.map((entry) => ({
    images: entry.images,
    expected: extractionToRecipe(entry.expectedExtraction),
  }));

  console.log(
    `Evaluating extraction quality: ${groundTruthForEval.length} entries with expectedExtraction, ` +
      `${matchedPredictions.length} matching predictions...`,
  );

  const { metrics, perEntry } = aggregateMetrics(
    matchedPredictions,
    groundTruthForEval,
  );

  // Attach per-entry text fidelity scores
  for (const entry of perEntry) {
    if (entry.missingPrediction) continue;
    const gt = extractionByKey.get(imageSetKey(entry.images));
    const predicted = extractionPredictions.entries.find(
      (candidate) => imageSetKey(candidate.images) === imageSetKey(entry.images),
    )?.extracted;
    if (!gt || !predicted) continue;

    const predictedText = flattenExtractionText(predicted);
    const expectedText = flattenExtractionText(gt.expectedExtraction);
    const rougeL = computeRougeL(predictedText, expectedText);
    entry.textFidelity = {
      wordErrorRate: computeWordErrorRate(predictedText, expectedText),
      charErrorRate: computeCharErrorRate(predictedText, expectedText),
      rougeL,
    };
  }

  const textFidelityEntries = perEntry
    .filter((e) => e.textFidelity != null)
    .map((e) => e.textFidelity!);

  const missingCount = perEntry.filter((entry) => entry.missingPrediction).length;
  const metricsWithDiagnostics = {
    ...metrics,
    diagnostics:
      textFidelityEntries.length === 0
        ? undefined
        : {
            extractionText: {
              wordErrorRate:
                textFidelityEntries.reduce((sum, item) => sum + item.wordErrorRate, 0) /
                textFidelityEntries.length,
              charErrorRate:
                textFidelityEntries.reduce((sum, item) => sum + item.charErrorRate, 0) /
                textFidelityEntries.length,
              rougeL: {
                precision:
                  textFidelityEntries.reduce((sum, item) => sum + item.rougeL.precision, 0) /
                  textFidelityEntries.length,
                recall:
                  textFidelityEntries.reduce((sum, item) => sum + item.rougeL.recall, 0) /
                  textFidelityEntries.length,
                f1:
                  textFidelityEntries.reduce((sum, item) => sum + item.rougeL.f1, 0) /
                  textFidelityEntries.length,
              },
            },
          },
  };

  await Promise.all([
    writeJson(EXTRACTION_METRICS_PATH, metricsWithDiagnostics),
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
  console.log(
    `  Equipment F1:            ${metrics.byCategory.equipmentParsing.f1.toFixed(3)}`,
  );
  if (metricsWithDiagnostics.diagnostics?.extractionText) {
    console.log(
      `  WER / CER / ROUGE-L:     ${metricsWithDiagnostics.diagnostics.extractionText.wordErrorRate.toFixed(3)} / ` +
        `${metricsWithDiagnostics.diagnostics.extractionText.charErrorRate.toFixed(3)} / ` +
        `${metricsWithDiagnostics.diagnostics.extractionText.rougeL.f1.toFixed(3)}`,
    );
  }
  console.log(`\nExtraction metrics written to ${EXTRACTION_METRICS_PATH}`);
  console.log(`Per-entry scores written to ${EXTRACTION_PER_IMAGE_SCORES_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
