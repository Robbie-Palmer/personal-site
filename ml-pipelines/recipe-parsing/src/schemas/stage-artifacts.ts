import { z } from "zod";
import { ParsedRecipeSchema, RecipeFrontmatterSchema } from "recipe-domain";

export const StructuredIngredientSectionSchema = z.object({
  name: z.string().min(1).optional(),
  lines: z.array(z.string().min(1)).default([]),
});

export const StructuredTimerSchema = z.object({
  name: z.string().min(1).optional(),
  text: z.string().min(1),
  quantity: z.number().positive().optional(),
  unit: z.string().min(1).optional(),
});

export const StructuredTextRecipeSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  cuisine: z.string().min(1).optional(),
  servingsText: z.string().min(1).optional(),
  prepTimeText: z.string().min(1).optional(),
  cookTimeText: z.string().min(1).optional(),
  ingredientSections: z.array(StructuredIngredientSectionSchema).min(1),
  instructionLines: z.array(z.string().min(1)).min(1),
  notes: z.array(z.string().min(1)).default([]),
  equipment: z.array(z.string().min(1)).default([]),
  timers: z.array(StructuredTimerSchema).default([]),
});

export type StructuredTextRecipe = z.infer<typeof StructuredTextRecipeSchema>;

export const CooklangFrontmatterSchema = RecipeFrontmatterSchema.partial({
  title: true,
  description: true,
  date: true,
  servings: true,
  cuisine: true,
  prepTime: true,
  cookTime: true,
  image: true,
  imageAlt: true,
  ingredientAnnotations: true,
}).extend({
  tags: z.array(z.string().min(1)).default([]),
});

export type CooklangFrontmatter = z.infer<typeof CooklangFrontmatterSchema>;

export const CooklangRecipeSchema = z.object({
  frontmatter: CooklangFrontmatterSchema,
  body: z.string(),
  diagnostics: z.array(z.string().min(1)).default([]),
  derived: ParsedRecipeSchema.optional(),
});

export type CooklangRecipe = z.infer<typeof CooklangRecipeSchema>;

export const StructuredTextPredictionEntrySchema = z.object({
  images: z.array(z.string().min(1)).min(1),
  extracted: StructuredTextRecipeSchema,
});

export type StructuredTextPredictionEntry = z.infer<
  typeof StructuredTextPredictionEntrySchema
>;

export const StructuredTextPredictionsDatasetSchema = z.object({
  entries: z.array(StructuredTextPredictionEntrySchema),
});

export type StructuredTextPredictionsDataset = z.infer<
  typeof StructuredTextPredictionsDatasetSchema
>;

export const CooklangPredictionEntrySchema = z.object({
  images: z.array(z.string().min(1)).min(1),
  cooklang: CooklangRecipeSchema,
});

export type CooklangPredictionEntry = z.infer<
  typeof CooklangPredictionEntrySchema
>;

export const CooklangPredictionsDatasetSchema = z.object({
  entries: z.array(CooklangPredictionEntrySchema),
});

export type CooklangPredictionsDataset = z.infer<
  typeof CooklangPredictionsDatasetSchema
>;
