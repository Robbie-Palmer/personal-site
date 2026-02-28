import { z } from "zod";
import { IngredientCategorySchema } from "recipe-domain";

export const CanonicalIngredientSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  category: IngredientCategorySchema,
});

export type CanonicalIngredient = z.infer<typeof CanonicalIngredientSchema>;

export const CanonicalIngredientsDataSchema = z.object({
  ingredients: z.array(CanonicalIngredientSchema).min(1),
});

export type CanonicalIngredientsData = z.infer<typeof CanonicalIngredientsDataSchema>;
