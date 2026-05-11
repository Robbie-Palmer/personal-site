import type { RecipeIngredient } from "recipe-domain";
import {
  createIngredientGroupAccumulator,
  mergeIngredientIntoGroup,
} from "recipe-domain";
import type { Recipe } from "../schemas/ground-truth.js";
import { normalizeCuisineLabels } from "./cuisine-normalization.js";
import { normalizeIngredientSlugForOutput } from "./ingredient-normalization-rules.js";

const DASH_CHARS_RE = /[\u2010-\u2015\u2212]/gu;

function normalizeTextForOutput(text: string): string {
  return text.replace(DASH_CHARS_RE, "-").replace(/\s+/g, " ").trim();
}

function normalizeOptionalPositiveTime(value: number | undefined): number | undefined {
  return value != null && Number.isFinite(value) && value > 0 ? value : undefined;
}

export function postprocessRecipeOutput(recipe: Recipe): Recipe {
  return {
    ...recipe,
    title: normalizeTextForOutput(recipe.title),
    description: normalizeTextForOutput(recipe.description),
    cuisine: normalizeCuisineLabels(
      (recipe.cuisine ?? []).map(normalizeTextForOutput),
    ),
    prepTime: normalizeOptionalPositiveTime(recipe.prepTime),
    cookTime: normalizeOptionalPositiveTime(recipe.cookTime),
    ingredientGroups: recipe.ingredientGroups.map((group) => {
      const normalizedItems: RecipeIngredient[] = group.items.map((item) => ({
        ...item,
        ingredient: normalizeIngredientSlugForOutput(item.ingredient),
        ...(item.preparation
          ? { preparation: normalizeTextForOutput(item.preparation) }
          : {}),
        ...(item.note ? { note: normalizeTextForOutput(item.note) } : {}),
      }));
      // Re-merge after slug normalization: aliases like red-pepper →
      // bell-pepper may have created duplicates within the same group.
      const acc = createIngredientGroupAccumulator(group.name);
      for (const item of normalizedItems) {
        try {
          mergeIngredientIntoGroup(acc, item);
        } catch {
          // Irreconcilable conflict (e.g. different preparations) — keep both.
          acc.items.push(item);
        }
      }
      return {
        ...(acc.name ? { name: normalizeTextForOutput(acc.name) } : {}),
        items: acc.items,
      };
    }),
    instructions: (recipe.instructions ?? []).map(normalizeTextForOutput),
    cookware: (recipe.cookware ?? []).map(normalizeTextForOutput),
  };
}
