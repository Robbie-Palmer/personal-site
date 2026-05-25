import {
  CANONICALIZATION_SCORING_PROFILE,
  EXTRACTION_SCORING_PROFILE,
  NORMALIZATION_SCORING_PROFILE,
  type ScalarFieldScores,
  type ScoringProfile,
  computeEntryScores,
  evaluateEquipmentParsing,
  evaluateIngredientParsing,
  evaluateInstructions,
  evaluateScalarFields,
} from "../../../../src/evaluation/metrics.js";
import { extractionToRecipe } from "../../../../src/lib/extraction-to-recipe.js";
import type { Recipe } from "../../../../src/schemas/ground-truth.js";
import type { ExtractionRecipe } from "../types/extraction";

export interface DetailScoreBreakdown {
  overall: number;
  scalarFields?: number;
  ingredientParsing?: number;
  instructions?: number;
  equipmentParsing?: number;
}

function weightedAverage(values: Array<{ value: number; weight: number }>): number | undefined {
  const active = values.filter(({ weight }) => weight > 0);
  if (active.length === 0) return undefined;
  const totalWeight = active.reduce((sum, { weight }) => sum + weight, 0);
  if (totalWeight === 0) return undefined;
  return active.reduce((sum, { value, weight }) => sum + value * weight, 0) / totalWeight;
}

function scoreActiveScalarFields(
  scalar: ScalarFieldScores,
  profile: ScoringProfile,
): number | undefined {
  return weightedAverage([
    { value: scalar.title.f1, weight: profile.weights.title ?? 0 },
    { value: scalar.description.f1, weight: profile.weights.description ?? 0 },
    { value: scalar.cuisine.f1, weight: profile.weights.cuisine ?? 0 },
    { value: scalar.servings.accuracy, weight: profile.weights.servings ?? 0 },
    { value: scalar.prepTime.accuracy, weight: profile.weights.prepTime ?? 0 },
    { value: scalar.cookTime.accuracy, weight: profile.weights.cookTime ?? 0 },
  ]);
}

function scoreRecipes(
  predicted: Recipe,
  expected: Recipe,
  profile: ScoringProfile,
): DetailScoreBreakdown {
  const scalar = evaluateScalarFields(predicted, expected);
  const ingredients = evaluateIngredientParsing(predicted, expected);
  const instructions = evaluateInstructions(predicted, expected);
  const equipment = evaluateEquipmentParsing(predicted, expected);
  const scores = computeEntryScores(scalar, ingredients, instructions, equipment, profile);
  return {
    overall: scores.overall,
    scalarFields: scoreActiveScalarFields(scalar, profile),
    ingredientParsing:
      (profile.weights.ingredientParsing ?? 0) > 0 ? scores.ingredientParsing : undefined,
    instructions:
      (profile.weights.instructions ?? 0) > 0 ? scores.instructions : undefined,
    equipmentParsing:
      (profile.weights.equipmentParsing ?? 0) > 0 ? scores.equipmentParsing : undefined,
  };
}

export function computeExtractionDetailScores(
  predicted: ExtractionRecipe,
  expected: ExtractionRecipe,
): DetailScoreBreakdown {
  return scoreRecipes(
    extractionToRecipe(predicted),
    extractionToRecipe(expected),
    EXTRACTION_SCORING_PROFILE,
  );
}

export function computeNormalizationDetailScores(
  predicted: Recipe,
  expected: Recipe,
): DetailScoreBreakdown {
  return scoreRecipes(predicted, expected, NORMALIZATION_SCORING_PROFILE);
}

export function computeCanonicalizationDetailScores(
  predicted: Recipe,
  expected: Recipe,
): DetailScoreBreakdown {
  return scoreRecipes(predicted, expected, CANONICALIZATION_SCORING_PROFILE);
}
