import pluralize from "pluralize";
import type { RecipeIngredientView } from "./recipeViews";

const UNCOUNTABLE_INGREDIENTS = [
  "butter",
  "water",
  "milk",
  "rice",
  "pasta",
  "flour",
  "sugar",
  "salt",
  "pepper",
  "garlic",
  "spinach",
  "cheese",
  "msg",
];

let hasInitializedIngredientPluralizeRules = false;

export function initIngredientPluralizeRules(): void {
  if (hasInitializedIngredientPluralizeRules) return;
  for (const ingredient of UNCOUNTABLE_INGREDIENTS) {
    pluralize.addUncountableRule(ingredient);
  }
  hasInitializedIngredientPluralizeRules = true;
}

type IngredientNameFields = Pick<RecipeIngredientView, "name" | "pluralName">;
type IngredientPluralizationFields = Pick<
  RecipeIngredientView,
  "name" | "pluralName" | "unit" | "amount"
>;

export function pluralizeIngredientName(item: IngredientNameFields): string {
  initIngredientPluralizeRules();
  if (item.pluralName) return item.pluralName;
  return pluralize(item.name);
}

// pluralName is a plural-only override, so singularization uses item.name.
function singularizeIngredientName(item: IngredientNameFields): string {
  initIngredientPluralizeRules();
  return pluralize.singular(item.name);
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
