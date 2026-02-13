import { z } from "zod";
import { normalizeSlug } from "./slugs";

export const IngredientSlugSchema = z.string().min(1);
export type IngredientSlug = z.infer<typeof IngredientSlugSchema>;

export const IngredientCategorySchema = z.enum([
  "protein",
  "vegetable",
  "fruit",
  "herb",
  "dairy",
  "grain",
  "spice",
  "condiment",
  "oil-fat",
  "liquid",
  "other",
]);
export type IngredientCategory = z.infer<typeof IngredientCategorySchema>;

export const IngredientSchema = z.object({
  name: z.string().min(1),
  pluralName: z.string().min(1).optional(),
  slug: IngredientSlugSchema.optional(),
  category: IngredientCategorySchema.optional(),
});

export type IngredientContent = z.infer<typeof IngredientSchema>;

export type Ingredient = IngredientContent & {
  slug: IngredientSlug;
};

export function resolveIngredientSlug(
  ingredient: IngredientContent,
): IngredientSlug {
  return (ingredient.slug || normalizeSlug(ingredient.name)) as IngredientSlug;
}
