import { z } from "zod";
import { IngredientSlugSchema } from "./ingredient";
import { UnitSchema } from "./unit";

export const RecipeSlugSchema = z.string().min(1);
export type RecipeSlug = z.infer<typeof RecipeSlugSchema>;

export const RecipeIngredientSchema = z.object({
  ingredient: IngredientSlugSchema,
  amount: z.number().positive().optional(),
  unit: UnitSchema.optional(),
  preparation: z.string().optional(),
  note: z.string().optional(),
});

export type RecipeIngredient = z.infer<typeof RecipeIngredientSchema>;

export const IngredientGroupSchema = z.object({
  name: z.string().optional(),
  items: z.array(RecipeIngredientSchema).min(1),
});

export type IngredientGroup = z.infer<typeof IngredientGroupSchema>;

export const ParsedRecipeSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  cuisine: z.string().optional(),
  servings: z.number().int().positive(),
  prepTime: z.number().int().nonnegative().optional(),
  cookTime: z.number().int().nonnegative().optional(),
  ingredientGroups: z.array(IngredientGroupSchema).min(1),
  instructions: z.array(z.string().min(1)).min(1),
});

export type ParsedRecipe = z.infer<typeof ParsedRecipeSchema>;

export const RecipeContentSchema = ParsedRecipeSchema.extend({
  slug: RecipeSlugSchema.optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tags: z.array(z.string()).default([]),
  image: z
    .string()
    .regex(/^recipes\/[a-z0-9_-]+-\d{4}-\d{2}-\d{2}$/)
    .optional(),
  imageAlt: z.string().min(1).optional(),
});

export type RecipeContent = z.infer<typeof RecipeContentSchema>;

export type Recipe = RecipeContent & {
  slug: RecipeSlug;
};
