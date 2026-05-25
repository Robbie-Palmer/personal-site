import type { ParsedRecipe } from "recipe-domain";
import {
  CANONICALIZATION_SCORING_PROFILE,
  EXTRACTION_SCORING_PROFILE,
  NORMALIZATION_SCORING_PROFILE,
  type ScoringProfile,
  computeEntryScores,
  evaluateEquipmentParsing,
  evaluateIngredientParsing,
  evaluateInstructions,
  evaluateScalarFields,
} from "../../../../src/evaluation/metrics.js";
import { extractionToRecipe } from "../../../../src/lib/extraction-to-recipe.js";
import type { ExtractionRecipe } from "../types/extraction";
import type { EntryScores as ReviewEntryScores } from "../types/review";

type ScoreBreakdown = ReviewEntryScores;

function scoreRecipes(
  predicted: ParsedRecipe,
  expected: ParsedRecipe,
  profile: ScoringProfile,
): ScoreBreakdown {
  const scalar = evaluateScalarFields(predicted as never, expected as never);
  const ingredients = evaluateIngredientParsing(predicted as never, expected as never);
  const instructions = evaluateInstructions(predicted as never, expected as never);
  const equipment = evaluateEquipmentParsing(predicted as never, expected as never);
  return computeEntryScores(scalar, ingredients, instructions, equipment, profile);
}

export function computeExtractionDetailScores(
  predicted: ExtractionRecipe,
  expected: ExtractionRecipe,
): ScoreBreakdown {
  return scoreRecipes(
    extractionToRecipe(predicted) as never,
    extractionToRecipe(expected) as never,
    EXTRACTION_SCORING_PROFILE,
  );
}

export function computeNormalizationDetailScores(
  predicted: ParsedRecipe,
  expected: ParsedRecipe,
): ScoreBreakdown {
  return scoreRecipes(predicted, expected, NORMALIZATION_SCORING_PROFILE);
}

export function computeCanonicalizationDetailScores(
  predicted: ParsedRecipe,
  expected: ParsedRecipe,
): ScoreBreakdown {
  return scoreRecipes(predicted, expected, CANONICALIZATION_SCORING_PROFILE);
}
