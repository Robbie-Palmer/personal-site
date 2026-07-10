import rawCanonicalIngredients from "../data/canonical-ingredients.json";
import {
  CanonicalIngredientsDataSchema,
  type CanonicalIngredientsData,
} from "../schemas/canonical-ingredients.js";

export const canonicalIngredients: CanonicalIngredientsData =
  CanonicalIngredientsDataSchema.parse(rawCanonicalIngredients);
