import {
  inferCooklangIngredientLine,
  parseIngredientLine,
  parseScalarTextNumber,
} from "./cooklang.js";
import type { Recipe } from "../schemas/ground-truth.js";

/** Minimal extraction shape accepted by the converter. */
interface ExtractionInput {
  title: string;
  description?: string;
  cuisine?: string;
  servings?: string;
  prepTime?: string;
  cookTime?: string;
  ingredientGroups: { name?: string; lines: string[] }[];
  instructions: string[];
  equipment?: string[];
}

/**
 * Convert a text-based extraction to a full Recipe for aggregateMetrics
 * compatibility. Parses ingredient text lines into structured RecipeIngredient
 * objects via the Cooklang line-inference heuristic. Both prediction and
 * ground-truth sides go through the same conversion so parsing noise is
 * symmetric.
 */
export function extractionToRecipe(extraction: ExtractionInput): Recipe {
  const ingredientGroups = extraction.ingredientGroups.map((group) => ({
    ...(group.name ? { name: group.name } : {}),
    items: group.lines.flatMap((line) =>
      parseIngredientLine(inferCooklangIngredientLine(line)),
    ),
  }));

  return {
    title: extraction.title,
    description: extraction.description ?? "",
    cuisine: extraction.cuisine ? [extraction.cuisine] : [],
    servings: parseScalarTextNumber(extraction.servings) ?? 0,
    prepTime: parseScalarTextNumber(extraction.prepTime),
    cookTime: parseScalarTextNumber(extraction.cookTime),
    ingredientGroups,
    instructions: extraction.instructions,
    cookware: extraction.equipment ?? [],
  };
}
