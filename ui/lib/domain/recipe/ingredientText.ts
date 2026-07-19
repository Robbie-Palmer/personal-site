import {
  pluralizeIngredientTerm,
  singularizeIngredientTerm,
} from "recipe-domain/pluralization";
import type { RecipeIngredientView } from "./recipeViews";
import { UNIT_LABELS } from "./unit";

type IngredientNameFields = Pick<RecipeIngredientView, "name" | "pluralName">;
type IngredientPluralizationFields = Pick<
  RecipeIngredientView,
  "name" | "pluralName" | "unit" | "amount"
>;

export function getDisplayedScaledAmount(
  amount: number | undefined,
  scale: number,
): number | undefined {
  if (amount == null) {
    return undefined;
  }

  const scaledAmount = amount * scale;
  if (!Number.isFinite(scaledAmount)) {
    return undefined;
  }

  return parseFloat(scaledAmount.toPrecision(2));
}

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

  const scaledAmount = getDisplayedScaledAmount(item.amount, scale);
  if (scaledAmount == null) {
    return item.name;
  }

  if (Math.abs(scaledAmount - 1) < SINGULAR_EPSILON) {
    return singularizeIngredientName(item);
  }

  return pluralizeIngredientName(item);
}

const FRACTION_MAP: Array<[number, string]> = [
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [1 / 2, "½"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
];

function formatStaticAmount(amount: number): string {
  const whole = Math.floor(amount);
  const frac = amount - whole;
  if (frac < 0.01) return String(whole);
  for (const [value, symbol] of FRACTION_MAP) {
    if (Math.abs(frac - value) < 0.02) {
      return whole > 0 ? `${whole}${symbol}` : symbol;
    }
  }
  return amount.toFixed(1);
}

/**
 * Unscaled plain-text rendering of an ingredient for static exports
 * (schema.org JSON-LD and the agent Markdown twins): fractional amounts,
 * pluralised unit/name, preparation in parens, and — when requested — the
 * free-text note after a dash.
 */
export function formatIngredientStaticText(
  item: RecipeIngredientView,
  options?: { includeNote?: boolean },
): string {
  const parts: string[] = [];

  if (item.amount != null) {
    parts.push(formatStaticAmount(item.amount));
  }

  // "piece" is a counting placeholder, not a label the UI ever renders.
  if (item.unit && item.unit !== "piece") {
    const label = UNIT_LABELS[item.unit];
    const isPluralUnit = item.amount != null && item.amount > 1;
    const unitStr = isPluralUnit ? label.plural : label.singular;
    if (label.noSpace && parts.length > 0) {
      parts[parts.length - 1] += unitStr;
    } else {
      parts.push(unitStr);
    }
  }

  // Mirror the UI formatter: names auto-pluralise only for bare "piece"
  // counts; measured units rely on an explicit pluralName override.
  const isPlural = item.amount != null && item.amount !== 1;
  let name = item.name;
  if (isPlural) {
    name =
      item.unit == null || item.unit === "piece"
        ? pluralizeIngredientName(item)
        : (item.pluralName ?? item.name);
  }
  parts.push(name);

  if (item.preparation) {
    parts.push(`(${item.preparation})`);
  }

  if (options?.includeNote && item.note) {
    parts.push(`– ${item.note}`);
  }

  return parts.join(" ").trim();
}
