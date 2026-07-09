import type {
  Ingredient,
  IngredientCategory,
  IngredientSlug,
} from "./ingredient";

export type KitchenLocation = "fridge" | "cupboards" | "fresh";

export type KitchenLocationView = {
  id: KitchenLocation;
  label: string;
  description: string;
};

export const KITCHEN_LOCATIONS: KitchenLocationView[] = [
  {
    id: "fridge",
    label: "Fridge",
    description: "Dairy, eggs, proteins, opened jars.",
  },
  {
    id: "cupboards",
    label: "Cupboards",
    description: "Pasta, tins, oils, spices, dry goods.",
  },
  {
    id: "fresh",
    label: "Fresh",
    description: "Fruit, vegetables, herbs.",
  },
];

export type KitchenIngredientView = {
  slug: IngredientSlug;
  name: string;
  category?: IngredientCategory;
  defaultLocation: KitchenLocation;
};

export type KitchenRecipeIngredientView = {
  slug: IngredientSlug;
  name: string;
};

export type KitchenRecipeView = {
  slug: string;
  title: string;
  description: string;
  cuisine: string[];
  totalTime?: number;
  ingredients: KitchenRecipeIngredientView[];
};

export type KitchenRecipeMatch = KitchenRecipeView & {
  haveCount: number;
  missingCount: number;
  totalCount: number;
  matchRatio: number;
  missingIngredients: KitchenRecipeIngredientView[];
};

const FRIDGE_CATEGORIES = new Set<IngredientCategory>(["dairy", "protein"]);
const FRESH_CATEGORIES = new Set<IngredientCategory>([
  "fruit",
  "herb",
  "vegetable",
]);

export function isKitchenLocation(value: unknown): value is KitchenLocation {
  return KITCHEN_LOCATIONS.some((location) => location.id === value);
}

export function getDefaultKitchenLocation(
  ingredient: Pick<Ingredient, "category" | "name">,
): KitchenLocation {
  if (ingredient.category && FRIDGE_CATEGORIES.has(ingredient.category)) {
    return "fridge";
  }

  if (ingredient.category && FRESH_CATEGORIES.has(ingredient.category)) {
    return "fresh";
  }

  return "cupboards";
}

export function toKitchenIngredientView(
  ingredient: Ingredient,
): KitchenIngredientView {
  return {
    slug: ingredient.slug,
    name: ingredient.name,
    category: ingredient.category,
    defaultLocation: getDefaultKitchenLocation(ingredient),
  };
}

export function getKitchenRecipeMatches(
  recipes: KitchenRecipeView[],
  availableIngredientSlugs: Iterable<IngredientSlug>,
): KitchenRecipeMatch[] {
  const available = new Set(availableIngredientSlugs);

  return recipes
    .map((recipe) => {
      const requiredBySlug = new Map<
        IngredientSlug,
        KitchenRecipeIngredientView
      >();
      for (const ingredient of recipe.ingredients) {
        requiredBySlug.set(ingredient.slug, ingredient);
      }

      const required = Array.from(requiredBySlug.values());
      const missingIngredients = required.filter(
        (ingredient) => !available.has(ingredient.slug),
      );
      const totalCount = required.length;
      const missingCount = missingIngredients.length;
      const haveCount = totalCount - missingCount;

      return {
        ...recipe,
        ingredients: required,
        haveCount,
        missingCount,
        totalCount,
        matchRatio: totalCount > 0 ? haveCount / totalCount : 0,
        missingIngredients,
      };
    })
    .sort((a, b) => {
      const missingComparison = a.missingCount - b.missingCount;
      if (missingComparison !== 0) return missingComparison;

      const ratioComparison = b.matchRatio - a.matchRatio;
      if (ratioComparison !== 0) return ratioComparison;

      return a.title.localeCompare(b.title);
    });
}
