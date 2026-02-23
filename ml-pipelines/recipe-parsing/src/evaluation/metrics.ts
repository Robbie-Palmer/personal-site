import type {
  GroundTruthEntry,
  Recipe,
  PredictionEntry,
} from "../schemas/ground-truth";
import { imageSetKey } from "../lib/image-key.js";

export interface F1Scores {
  precision: number;
  recall: number;
  f1: number;
}

export interface ScalarFieldScores {
  title: F1Scores;
  description: F1Scores;
  cuisine: { accuracy: number };
  servings: { accuracy: number };
  prepTime: { accuracy: number };
  cookTime: { accuracy: number };
}

export interface IngredientParsingScores extends F1Scores {
  fieldScores: {
    name: F1Scores;
    amount: { accuracy: number };
    unit: { accuracy: number };
    preparation: F1Scores;
  };
}

export interface EntryScores {
  images: string[];
  missingPrediction?: boolean;
  scores: {
    overall: number;
    scalarFields: number;
    ingredientParsing: number;
    instructions: number;
  };
}

export interface AggregateMetrics {
  overall: { score: number };
  byCategory: {
    scalarFields: ScalarFieldScores;
    ingredientParsing: IngredientParsingScores;
    instructions: F1Scores;
  };
  entryCount: number;
}

export function splitWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

export function computeSetF1(
  predicted: Set<string>,
  expected: Set<string>,
): F1Scores {
  if (predicted.size === 0 && expected.size === 0) {
    return { precision: 1, recall: 1, f1: 1 };
  }
  const truePositives = [...predicted].filter((x) => expected.has(x)).length;
  const precision =
    predicted.size === 0 ? 0 : truePositives / predicted.size;
  const recall = expected.size === 0 ? 0 : truePositives / expected.size;
  const f1 =
    precision + recall === 0
      ? 0
      : (2 * precision * recall) / (precision + recall);
  return { precision, recall, f1 };
}

export function computeWordOverlapF1(
  predicted: string,
  expected: string,
): F1Scores {
  const predWords = new Set(splitWords(predicted));
  const expWords = new Set(splitWords(expected));
  return computeSetF1(predWords, expWords);
}

function exactMatch(predicted: unknown, expected: unknown): number {
  return predicted === expected ? 1.0 : 0.0;
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function avgF1(scores: F1Scores[]): F1Scores {
  if (scores.length === 0) return { precision: 0, recall: 0, f1: 0 };
  return {
    precision: avg(scores.map((s) => s.precision)),
    recall: avg(scores.map((s) => s.recall)),
    f1: avg(scores.map((s) => s.f1)),
  };
}

export function computeBagF1(
  predicted: string[],
  expected: string[],
): F1Scores {
  if (predicted.length === 0 && expected.length === 0) {
    return { precision: 1, recall: 1, f1: 1 };
  }

  const predCounts = new Map<string, number>();
  for (const p of predicted) {
    predCounts.set(p, (predCounts.get(p) ?? 0) + 1);
  }

  const expCounts = new Map<string, number>();
  for (const e of expected) {
    expCounts.set(e, (expCounts.get(e) ?? 0) + 1);
  }

  let truePositives = 0;
  for (const [item, pCount] of predCounts) {
    const eCount = expCounts.get(item) ?? 0;
    truePositives += Math.min(pCount, eCount);
  }

  const precision =
    predicted.length === 0 ? 0 : truePositives / predicted.length;
  const recall = expected.length === 0 ? 0 : truePositives / expected.length;
  const f1 =
    precision + recall === 0
      ? 0
      : (2 * precision * recall) / (precision + recall);
  return { precision, recall, f1 };
}

export function evaluateScalarFields(
  predicted: Recipe,
  expected: Recipe,
): ScalarFieldScores {
  return {
    title: computeWordOverlapF1(predicted.title, expected.title),
    description: computeWordOverlapF1(predicted.description, expected.description),
    cuisine: {
      accuracy: exactMatch(
        predicted.cuisine?.toLowerCase(),
        expected.cuisine?.toLowerCase(),
      ),
    },
    servings: { accuracy: exactMatch(predicted.servings, expected.servings) },
    prepTime: { accuracy: exactMatch(predicted.prepTime, expected.prepTime) },
    cookTime: { accuracy: exactMatch(predicted.cookTime, expected.cookTime) },
  };
}

function flattenIngredients(
  groups: Recipe["ingredientGroups"],
): Map<string, { amount?: number; unit?: string; preparation?: string }[]> {
  const map = new Map<
    string,
    { amount?: number; unit?: string; preparation?: string }[]
  >();
  for (const group of groups) {
    for (const item of group.items) {
      const existing = map.get(item.ingredient) ?? [];
      existing.push({
        amount: item.amount,
        unit: item.unit,
        preparation: item.preparation,
      });
      map.set(item.ingredient, existing);
    }
  }
  return map;
}

export function evaluateIngredientParsing(
  predicted: Recipe,
  expected: Recipe,
): IngredientParsingScores {
  const predIngredients = flattenIngredients(predicted.ingredientGroups);
  const expIngredients = flattenIngredients(expected.ingredientGroups);

  const predSlugs: string[] = [];
  for (const [slug, items] of predIngredients) {
    for (let i = 0; i < items.length; i++) predSlugs.push(slug);
  }
  const expSlugs: string[] = [];
  for (const [slug, items] of expIngredients) {
    for (let i = 0; i < items.length; i++) expSlugs.push(slug);
  }

  const idF1 = computeBagF1(predSlugs, expSlugs);
  const commonSlugs = new Set(
    [...predIngredients.keys()].filter((k) => expIngredients.has(k)),
  );

  const nameScores: F1Scores[] = [];
  const amountAccuracies: number[] = [];
  const unitAccuracies: number[] = [];
  const prepScores: F1Scores[] = [];

  for (const slug of commonSlugs) {
    const preds = predIngredients.get(slug)!;
    const exps = expIngredients.get(slug)!;
    const pairCount = Math.min(preds.length, exps.length);
    for (let i = 0; i < pairCount; i++) {
      const pred = preds[i]!;
      const exp = exps[i]!;
      nameScores.push({ precision: 1, recall: 1, f1: 1 });
      amountAccuracies.push(exactMatch(pred.amount, exp.amount));
      unitAccuracies.push(exactMatch(pred.unit, exp.unit));
      prepScores.push(
        computeWordOverlapF1(pred.preparation ?? "", exp.preparation ?? ""),
      );
    }
  }

  return {
    ...idF1,
    fieldScores: {
      name: avgF1(nameScores),
      amount: { accuracy: avg(amountAccuracies) },
      unit: { accuracy: avg(unitAccuracies) },
      preparation: avgF1(prepScores),
    },
  };
}

export function evaluateInstructions(
  predicted: Recipe,
  expected: Recipe,
): F1Scores {
  return computeWordOverlapF1(
    predicted.instructions.join(" "),
    expected.instructions.join(" "),
  );
}

export function computeEntryScores(
  scalar: ScalarFieldScores,
  ingredients: IngredientParsingScores,
  instructions: F1Scores,
): EntryScores["scores"] {
  const scalarScore = avg([
    scalar.title.f1,
    scalar.description.f1,
    scalar.cuisine.accuracy,
    scalar.servings.accuracy,
    scalar.prepTime.accuracy,
    scalar.cookTime.accuracy,
  ]);
  const overall = avg([scalarScore, ingredients.f1, instructions.f1]);
  return {
    overall,
    scalarFields: scalarScore,
    ingredientParsing: ingredients.f1,
    instructions: instructions.f1,
  };
}

export function makeMissingEntryScores(images: string[]): EntryScores {
  return {
    images,
    missingPrediction: true,
    scores: {
      overall: 0,
      scalarFields: 0,
      ingredientParsing: 0,
      instructions: 0,
    },
  };
}

export function aggregateMetrics(
  predictions: PredictionEntry[],
  groundTruth: GroundTruthEntry[],
): { metrics: AggregateMetrics; perEntry: EntryScores[] } {
  const predictionsByImageKey = new Map<string, PredictionEntry>();
  for (const prediction of predictions) {
    const key = imageSetKey(prediction.images);
    const existing = predictionsByImageKey.get(key);
    if (existing) {
      throw new Error(
        `Duplicate prediction key encountered for images [${prediction.images.join(", ")}]. ` +
          `existingTitle="${existing.predicted.title}" duplicateTitle="${prediction.predicted.title}"`,
      );
    }
    predictionsByImageKey.set(key, prediction);
  }

  const allScalar: ScalarFieldScores[] = [];
  const allIngredients: IngredientParsingScores[] = [];
  const allInstructions: F1Scores[] = [];
  const perEntry: EntryScores[] = [];

  for (const gt of groundTruth) {
    const key = imageSetKey(gt.images);
    const pred = predictionsByImageKey.get(key);
    if (!pred) {
      // By-category aggregates exclude missing predictions by design; overall/per-entry
      // still include them via explicit zero scores to reflect completeness penalties.
      perEntry.push(makeMissingEntryScores(gt.images));
      continue;
    }

    const scalar = evaluateScalarFields(pred.predicted, gt.expected);
    const ingredients = evaluateIngredientParsing(pred.predicted, gt.expected);
    const instructions = evaluateInstructions(pred.predicted, gt.expected);

    allScalar.push(scalar);
    allIngredients.push(ingredients);
    allInstructions.push(instructions);

    const scores = computeEntryScores(scalar, ingredients, instructions);
    perEntry.push({
      images: pred.images,
      scores,
    });
  }

  const groundTruthKeys = new Set(groundTruth.map((entry) => imageSetKey(entry.images)));
  const unmatchedPredictionKeys = [...predictionsByImageKey.keys()].filter(
    (key) => !groundTruthKeys.has(key),
  );
  if (unmatchedPredictionKeys.length > 0) {
    const sampleKeys = unmatchedPredictionKeys.slice(0, 3).join(", ");
    console.warn(
      `Found ${unmatchedPredictionKeys.length} prediction(s) without matching ground truth entries. Sample keys: ${sampleKeys}`,
    );
  }

  const scalarFields: ScalarFieldScores = {
    title: avgF1(allScalar.map((s) => s.title)),
    description: avgF1(allScalar.map((s) => s.description)),
    cuisine: { accuracy: avg(allScalar.map((s) => s.cuisine.accuracy)) },
    servings: { accuracy: avg(allScalar.map((s) => s.servings.accuracy)) },
    prepTime: { accuracy: avg(allScalar.map((s) => s.prepTime.accuracy)) },
    cookTime: { accuracy: avg(allScalar.map((s) => s.cookTime.accuracy)) },
  };

  const ingredientParsing: IngredientParsingScores = {
    ...avgF1(allIngredients),
    fieldScores: {
      name: avgF1(allIngredients.map((s) => s.fieldScores.name)),
      amount: {
        accuracy: avg(allIngredients.map((s) => s.fieldScores.amount.accuracy)),
      },
      unit: {
        accuracy: avg(allIngredients.map((s) => s.fieldScores.unit.accuracy)),
      },
      preparation: avgF1(
        allIngredients.map((s) => s.fieldScores.preparation),
      ),
    },
  };

  const instructions = avgF1(allInstructions);
  const overall: { score: number } = {
    score: avg(perEntry.map((e) => e.scores.overall)),
  };

  return {
    metrics: {
      overall,
      byCategory: {
        scalarFields,
        ingredientParsing,
        instructions,
      },
      entryCount: groundTruth.length,
    },
    perEntry,
  };
}
