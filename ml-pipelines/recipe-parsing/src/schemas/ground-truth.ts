import { z } from "zod";
import { ParsedRecipeSchema } from "recipe-domain";
import {
  CooklangRecipeSchema,
  StructuredTextRecipeSchema,
} from "./stage-artifacts.js";

export const RecipeSchema = ParsedRecipeSchema;
export type Recipe = z.infer<typeof RecipeSchema>;

/** Looser schema for extraction ground truth — description and servings are optional */
export const ExtractionRecipeSchema = ParsedRecipeSchema.partial({
  description: true,
  servings: true,
});
export type ExtractionRecipe = z.infer<typeof ExtractionRecipeSchema>;

export const GroundTruthEntrySchema = z.object({
  images: z.array(z.string().min(1)).min(1),
  expectedStructuredText: StructuredTextRecipeSchema.optional(),
  expectedCooklang: CooklangRecipeSchema.optional(),
  expectedExtraction: ExtractionRecipeSchema.optional(),
  expected: RecipeSchema,
});

export type GroundTruthEntry = z.infer<typeof GroundTruthEntrySchema>;

export const GroundTruthDatasetSchema = z.object({
  entries: z.array(GroundTruthEntrySchema).min(1),
});

export type GroundTruthDataset = z.infer<typeof GroundTruthDatasetSchema>;

export const PredictionEntrySchema = z.object({
  images: z.array(z.string().min(1)).min(1),
  predicted: RecipeSchema,
});

export type PredictionEntry = z.infer<typeof PredictionEntrySchema>;

export const PredictionsDatasetSchema = z.object({
  entries: z.array(PredictionEntrySchema).min(1),
});

export type PredictionsDataset = z.infer<typeof PredictionsDatasetSchema>;
