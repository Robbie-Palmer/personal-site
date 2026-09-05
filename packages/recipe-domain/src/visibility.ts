import { z } from "zod";

export const RECIPE_VISIBILITIES = [
  "public",
  "private",
  "household",
] as const;
export const RecipeVisibilitySchema = z.enum(RECIPE_VISIBILITIES);
export type RecipeVisibility = z.infer<typeof RecipeVisibilitySchema>;

const recipeVisibilities = new Set<string>(RECIPE_VISIBILITIES);

export function isRecipeVisibility(
  value: unknown,
): value is RecipeVisibility {
  return typeof value === "string" && recipeVisibilities.has(value);
}
