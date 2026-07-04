import type { ShoppingRecipe } from "@/lib/api/shopping";
import type {
  IngredientCategory,
  IngredientSlug,
} from "@/lib/domain/recipe/ingredient";
// Import from the specific unit module, not the domain barrel: the barrel
// re-exports recipeRepository → cooklang → Node fs/url, which must never reach
// the client bundle (this module is used by the client shopping list).
import {
  convertUnit,
  getUnitDimension,
  type Unit,
} from "@/lib/domain/recipe/unit";
import { aisleForCategory } from "./aisles";

/**
 * A single merged quantity on a shopping line. Dimensional amounts (weight /
 * volume) are normalised to a base unit (g / ml) so the UI can convert them to
 * the reader's measurement system at display time; discrete units (tins,
 * cloves, pieces…) and bare counts keep their own bucket.
 */
export type ShoppingQuantity = {
  amount: number;
  /** Base unit (g/ml) or a discrete unit; undefined for a bare count. */
  unit?: Unit;
};

export type ShoppingLine = {
  ingredient: IngredientSlug;
  name: string;
  pluralName?: string;
  category?: IngredientCategory;
  aisle: string;
  /**
   * One or more merged quantities. Empty when every contribution was
   * presence-only (an ingredient tagged with no amount), in which case the UI
   * shows just the name.
   */
  quantities: ShoppingQuantity[];
  /** Distinct recipes that contribute to this line, in selection order. */
  recipes: { slug: string; title: string }[];
};

export type SelectedRecipe = {
  recipe: ShoppingRecipe;
  /** Multiplier applied to every amount (chosen servings ÷ recipe servings). */
  scale: number;
};

// Bucket keys keep incompatible quantities apart: convertible units collapse
// onto their physical dimension, discrete units key on their own unit, and bare
// numbers share a "count" key.
const COUNT_BUCKET = "count";

type Bucket = {
  /** Running total, in the bucket's own unit (base unit for dimensional). */
  amount: number;
  unit: Unit | undefined;
};

type Accumulator = {
  ingredient: IngredientSlug;
  name: string;
  pluralName?: string;
  category?: IngredientCategory;
  buckets: Map<string, Bucket>;
  /** True once any contribution carried a real amount. */
  hasQuantified: boolean;
  recipes: Map<string, string>;
};

function addToBucket(
  acc: Accumulator,
  key: string,
  amount: number,
  unit: Unit | undefined,
): void {
  const existing = acc.buckets.get(key);
  if (!existing) {
    acc.buckets.set(key, { amount, unit });
    return;
  }
  existing.amount += amount;
}

function addContribution(
  acc: Accumulator,
  amount: number | undefined,
  unit: Unit | undefined,
): void {
  if (amount == null) return; // presence-only tag — records the recipe, no number
  acc.hasQuantified = true;

  // Dimensional units (weight/volume, incl. spoons/cups) accumulate in a base
  // unit so tsp + tbsp + g etc. can be summed. getUnitDimension is non-null
  // exactly for the units convertUnit knows, and the base unit shares that
  // dimension, so the conversion always succeeds here — but if it ever doesn't
  // (a future unit added to one table but not the other), fall through and bucket
  // the contribution under its own written unit rather than mislabelling a raw
  // amount as grams/millilitres.
  const dimension = unit != null ? getUnitDimension(unit) : null;
  if (unit != null && dimension != null) {
    const baseUnit: Unit = dimension === "weight" ? "g" : "ml";
    const baseAmount = convertUnit(amount, unit, baseUnit);
    if (baseAmount != null) {
      addToBucket(acc, dimension, baseAmount, baseUnit);
      return;
    }
  }

  // Discrete units (tin, clove, piece…) and bare counts keep their own bucket.
  addToBucket(acc, unit ? `unit:${unit}` : COUNT_BUCKET, amount, unit);
}

/**
 * Merge the ingredients of every selected recipe into a single de-duplicated
 * shopping list. Amounts are summed where their units are compatible and listed
 * side-by-side where they are not — never dropped and never throwing, unlike the
 * strict within-recipe merge in recipe-domain.
 */
export function aggregateShoppingList(
  selected: SelectedRecipe[],
): ShoppingLine[] {
  const accumulators = new Map<IngredientSlug, Accumulator>();

  for (const { recipe, scale } of selected) {
    // Guard against a stale/zero servings override producing NaN amounts.
    const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
    for (const item of recipe.ingredients) {
      let acc = accumulators.get(item.ingredient);
      if (!acc) {
        acc = {
          ingredient: item.ingredient,
          name: item.name,
          pluralName: item.pluralName,
          category: item.category as IngredientCategory | undefined,
          buckets: new Map(),
          hasQuantified: false,
          recipes: new Map(),
        };
        accumulators.set(item.ingredient, acc);
      }
      const amount = item.amount == null ? undefined : item.amount * safeScale;
      addContribution(acc, amount, item.unit);
      acc.recipes.set(recipe.slug, recipe.title);
    }
  }

  const lines: ShoppingLine[] = [];
  for (const acc of accumulators.values()) {
    const quantities: ShoppingQuantity[] = acc.hasQuantified
      ? [...acc.buckets.values()]
          .map((bucket) => ({
            amount: roundAmount(bucket.amount),
            unit: bucket.unit,
          }))
          .sort(compareQuantities)
      : [];
    lines.push({
      ingredient: acc.ingredient,
      name: acc.name,
      pluralName: acc.pluralName,
      category: acc.category,
      aisle: aisleForCategory(acc.category),
      quantities,
      recipes: [...acc.recipes.entries()].map(([slug, title]) => ({
        slug,
        title,
      })),
    });
  }
  return lines;
}

// Trim floating-point noise from summed/converted amounts (e.g. 0.30000000004).
function roundAmount(amount: number): number {
  return Math.round(amount * 1000) / 1000;
}

// Stable order for a line's quantities: dimensional first, then discrete units
// alphabetically, then bare counts.
function quantityRank(unit: Unit | undefined): number {
  if (unit === "g" || unit === "ml") return 0;
  if (unit) return 1;
  return 2;
}
function compareQuantities(a: ShoppingQuantity, b: ShoppingQuantity): number {
  const rank = quantityRank(a.unit) - quantityRank(b.unit);
  if (rank !== 0) return rank;
  return (a.unit ?? "").localeCompare(b.unit ?? "");
}
