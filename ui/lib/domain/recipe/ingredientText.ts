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

for (const ingredient of UNCOUNTABLE_INGREDIENTS) {
  pluralize.addUncountableRule(ingredient);
}

type IngredientNameFields = Pick<RecipeIngredientView, "name" | "pluralName">;
type IngredientPluralizationFields = Pick<
  RecipeIngredientView,
  "name" | "pluralName" | "unit" | "amount"
>;

export function pluralizeIngredientName(item: IngredientNameFields): string {
  if (item.pluralName) return item.pluralName;
  return pluralize(item.name);
}

function singularizeIngredientName(item: IngredientNameFields): string {
  return pluralize.singular(item.name);
}

export function formatIngredientName(
  item: IngredientPluralizationFields,
  scale: number,
): string {
  const scaledAmount = item.amount != null ? item.amount * scale : undefined;
  const isPiece = item.unit === "piece";
  if (isPiece && scaledAmount === 1) {
    return singularizeIngredientName(item);
  }
  const needsPlural = isPiece && scaledAmount != null && scaledAmount !== 1;
  return needsPlural ? pluralizeIngredientName(item) : item.name;
}
