import type { MeasurementPreference } from "@/lib/domain/recipe";
import { formatIngredientAmount } from "@/lib/domain/recipe/ingredientDisplay";
import { formatIngredientName } from "@/lib/domain/recipe/ingredientText";
import type { ShoppingLine, ShoppingQuantity } from "./aggregate";

/**
 * Render a line's merged quantities into a single string in the reader's
 * measurement system, e.g. "500g", "2 tins + 400g", or "" when the ingredient
 * was only ever tagged with no amount.
 */
export function formatShoppingQuantities(
  quantities: ShoppingQuantity[],
  system: MeasurementPreference,
): string {
  return quantities
    .map((quantity) => formatIngredientAmount(quantity, 1, system))
    .filter(Boolean)
    .join(" + ");
}

/**
 * The display name for a line, singular/plural-aware when the ingredient is
 * counted in whole pieces (e.g. "1 chicken breast" vs "2 chicken breasts").
 */
export function formatShoppingName(line: ShoppingLine): string {
  const piece = line.quantities.find((quantity) => quantity.unit === "piece");
  return formatIngredientName(
    {
      name: line.name,
      pluralName: line.pluralName,
      unit: piece ? "piece" : undefined,
      amount: piece?.amount,
    },
    1,
  );
}
