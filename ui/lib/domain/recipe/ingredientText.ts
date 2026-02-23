import {
  pluralizeIngredientTerm,
  singularizeIngredientTerm,
} from "recipe-domain/pluralization";
import type { RecipeIngredientView } from "./recipeViews";

type IngredientNameFields = Pick<RecipeIngredientView, "name" | "pluralName">;
type IngredientPluralizationFields = Pick<
  RecipeIngredientView,
  "name" | "pluralName" | "unit" | "amount"
>;

export function pluralizeIngredientName(item: IngredientNameFields): string {
  if (item.pluralName) return item.pluralName;
  return pluralizeIngredientTerm(item.name);
}

// pluralName is a plural-only override, so singularization uses item.name.
function singularizeIngredientName(item: IngredientNameFields): string {
  return singularizeIngredientTerm(item.name);
}

const SINGULAR_EPSILON = 1e-9;

export function formatIngredientName(
  item: IngredientPluralizationFields,
  scale: number,
): string {
  if (item.unit !== "piece" || item.amount == null) {
    return item.name;
  }

  const scaledAmount = item.amount * scale;
  if (!Number.isFinite(scaledAmount)) {
    return item.name;
  }

  if (Math.abs(scaledAmount - 1) < SINGULAR_EPSILON) {
    return singularizeIngredientName(item);
  }

  return pluralizeIngredientName(item);
}
