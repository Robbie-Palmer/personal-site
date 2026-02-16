import { normalizeSlug } from "recipe-domain/slugs";
import type {
  GroundTruthEntry,
  Recipe,
  PredictionEntry,
} from "../schemas/ground-truth";

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
  /** Per-field scores averaged across matched ingredients. */
  fieldScores: {
    name: F1Scores;
    amount: { accuracy: number };
    unit: { accuracy: number };
    preparation: F1Scores;
  };
}

export interface IngredientCategorizationScores {
  accuracy: number;
  perCategory: Record<string, F1Scores>;
}

export interface EntryScores {
  images: string[];
  scores: {
    overall: number;
    scalarFields: number;
    ingredientParsing: number;
    ingredientCategorization: number;
    instructions: number;
  };
}

export interface AggregateMetrics {
  overall: { score: number };
  byCategory: {
    scalarFields: ScalarFieldScores;
    ingredientParsing: IngredientParsingScores;
    ingredientCategorization: IngredientCategorizationScores;
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

/**
 * Compute F1 score based on word overlap.
 *
 * Note: uses Set semantics, so duplicate words are collapsed.
 * A "bag of words" approach would be needed to account for word frequency.
 */
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

/** Flatten all ingredients from ingredient groups into a map keyed by slug. */
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

  // Bag-level F1 for ingredient identification (counting duplicates)
  const predSlugs: string[] = [];
  for (const [slug, items] of predIngredients) {
    for (let i = 0; i < items.length; i++) predSlugs.push(slug);
  }
  const expSlugs: string[] = [];
  for (const [slug, items] of expIngredients) {
    for (let i = 0; i < items.length; i++) expSlugs.push(slug);
  }

  const idF1 = computeBagF1(predSlugs, expSlugs);

  // Per-field scores for matched ingredients
  // We iterate over the unique slugs that appear in both.
  // For each slug, we pair up the Nth predicted item with the Nth expected item.
  // Any extra items (unpaired) are ignored for field accuracy, as they are implicitly
  // penalized by the Bag F1 identification score.
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

    // Pair up items. Assume order matters / is consistent enough.
    const pairCount = Math.min(preds.length, exps.length);
    for (let i = 0; i < pairCount; i++) {
      const pred = preds[i]!;
      const exp = exps[i]!;

      // Name: matched by slug, so this is 1.0
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

export function evaluateIngredientCategorization(
  predictedIngredients?: GroundTruthEntry["knownIngredients"],
  expectedIngredients?: GroundTruthEntry["knownIngredients"],
): IngredientCategorizationScores {
  if (!expectedIngredients || expectedIngredients.length === 0) {
    return { accuracy: 0, perCategory: {} };
  }

  const expectedCategories = new Map<string, string>();
  for (const ing of expectedIngredients) {
    if (ing.category) {
      const slug = ing.slug ?? normalizeSlug(ing.name);
      if (expectedCategories.has(slug)) {
        const existing = expectedCategories.get(slug);
        if (existing !== ing.category) {
          console.warn(
            `Duplicate slug in expected ingredients: ${slug}. keeping ${existing}, ignoring ${ing.category} for ${ing.name}`,
          );
        }
      } else {
        expectedCategories.set(slug, ing.category);
      }
    }
  }

  const predictedCategories = new Map<string, string>();
  if (predictedIngredients) {
    for (const ing of predictedIngredients) {
      if (ing.category) {
        const slug = ing.slug ?? normalizeSlug(ing.name);
        if (predictedCategories.has(slug)) {
          const existing = predictedCategories.get(slug);
          if (existing !== ing.category) {
            console.warn(
              `Duplicate slug in predicted ingredients: ${slug}. keeping ${existing}, ignoring ${ing.category} for ${ing.name}`,
            );
          }
        } else {
          predictedCategories.set(slug, ing.category);
        }
      }
    }
  }

  const allCategories = new Set([
    ...expectedCategories.values(),
    ...predictedCategories.values(),
  ]);
  const perCategory: Record<string, { tp: number; fp: number; fn: number }> =
    {};
  for (const cat of allCategories) {
    perCategory[cat] = { tp: 0, fp: 0, fn: 0 };
  }

  // Score each expected ingredient
  for (const [slug, expectedCat] of expectedCategories) {
    const predictedCat = predictedCategories.get(slug);
    if (predictedCat === expectedCat) {
      perCategory[expectedCat]!.tp++;
    } else {
      perCategory[expectedCat]!.fn++;
      if (predictedCat) {
        perCategory[predictedCat]!.fp++;
      }
    }
  }

  // Count predicted categories for slugs not in expected (all false positives)
  for (const [slug, predictedCat] of predictedCategories) {
    if (!expectedCategories.has(slug)) {
      perCategory[predictedCat]!.fp++;
    }
  }

  const perCategoryF1: Record<string, F1Scores> = {};
  let totalCorrect = 0;
  let totalCount = 0;
  for (const [cat, counts] of Object.entries(perCategory)) {
    const precision =
      counts.tp + counts.fp === 0
        ? 0
        : counts.tp / (counts.tp + counts.fp);
    const recall =
      counts.tp + counts.fn === 0
        ? 0
        : counts.tp / (counts.tp + counts.fn);
    const f1 =
      precision + recall === 0
        ? 0
        : (2 * precision * recall) / (precision + recall);
    perCategoryF1[cat] = { precision, recall, f1 };
    totalCorrect += counts.tp;
    totalCount += counts.tp + counts.fn;
  }
  return {
    accuracy: totalCount === 0 ? 0 : totalCorrect / totalCount,
    perCategory: perCategoryF1,
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
  categorization: IngredientCategorizationScores,
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
  // Overall: weighted average of category scores
  const overall = avg([
    scalarScore,
    ingredients.f1,
    categorization.accuracy,
    instructions.f1,
  ]);
  return {
    overall,
    scalarFields: scalarScore,
    ingredientParsing: ingredients.f1,
    ingredientCategorization: categorization.accuracy,
    instructions: instructions.f1,
  };
}

export function evaluateEntry(
  prediction: PredictionEntry,
  expected: GroundTruthEntry,
): EntryScores {
  const scalar = evaluateScalarFields(prediction.predicted, expected.expected);
  const ingredients = evaluateIngredientParsing(
    prediction.predicted,
    expected.expected,
  );
  const categorization = evaluateIngredientCategorization(
    prediction.predictedIngredients,
    expected.knownIngredients,
  );
  const instructions = evaluateInstructions(
    prediction.predicted,
    expected.expected,
  );
  const scores = computeEntryScores(
    scalar,
    ingredients,
    categorization,
    instructions,
  );
  return {
    images: prediction.images,
    scores,
  };
}

export function aggregateMetrics(
  predictions: PredictionEntry[],
  groundTruth: GroundTruthEntry[],
): { metrics: AggregateMetrics; perEntry: EntryScores[] } {
  if (predictions.length !== groundTruth.length) {
    throw new Error(
      `Length mismatch: predictions (${predictions.length}) vs groundTruth (${groundTruth.length})`,
    );
  }

  const allScalar: ScalarFieldScores[] = [];
  const allIngredients: IngredientParsingScores[] = [];
  const allCategorization: IngredientCategorizationScores[] = [];
  const allInstructions: F1Scores[] = [];
  const perEntry: EntryScores[] = [];

  for (let i = 0; i < predictions.length; i++) {
    const pred = predictions[i]!;
    const gt = groundTruth[i]!;

    const scalar = evaluateScalarFields(pred.predicted, gt.expected);
    const ingredients = evaluateIngredientParsing(pred.predicted, gt.expected);
    const categorization = evaluateIngredientCategorization(
      pred.predictedIngredients,
      gt.knownIngredients,
    );
    const instructions = evaluateInstructions(pred.predicted, gt.expected);

    allScalar.push(scalar);
    allIngredients.push(ingredients);
    allCategorization.push(categorization);
    allInstructions.push(instructions);

    const scores = computeEntryScores(
      scalar,
      ingredients,
      categorization,
      instructions,
    );
    perEntry.push({
      images: pred.images,
      scores,
    });
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

  const allCategoryKeys = new Set(
    allCategorization.flatMap((c) => Object.keys(c.perCategory)),
  );
  const perCategory: Record<string, F1Scores> = {};
  for (const key of allCategoryKeys) {
    const categoryScores = allCategorization
      .map((c) => c.perCategory[key])
      .filter((s): s is F1Scores => s !== undefined);
    perCategory[key] = avgF1(categoryScores);
  }

  const ingredientCategorization: IngredientCategorizationScores = {
    accuracy: avg(allCategorization.map((c) => c.accuracy)),
    perCategory,
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
        ingredientCategorization,
        instructions,
      },
      entryCount: predictions.length,
    },
    perEntry,
  };
}
