import type { IngredientSlug } from "./ingredient";
import type { RecipeInstructionSdk } from "./recipe";
import type { Unit } from "./unit";

export type RecipeIngredientView = {
  ingredient: IngredientSlug;
  name: string;
  pluralName?: string;
  category?: string;
  amount?: number;
  unit?: Unit;
  preparation?: string;
  note?: string;
};

export type IngredientGroupView = {
  name?: string;
  items: RecipeIngredientView[];
};

type BaseRecipeView = {
  slug: string;
  title: string;
  description: string;
  date: string;
  cuisine: string[];
  tags: string[];
  servings: number;
  prepTime?: number;
  cookTime?: number;
  totalTime?: number;
  image?: string;
  imageAlt?: string;
  canonical?: string;
};

export type RecipeCardView = BaseRecipeView & {
  ingredientNames: string[];
  ingredientSlugs: IngredientSlug[];
  cookware: string[];
};

export type RecipeDetailView = BaseRecipeView & {
  cookBody: string;
  cookware: string[];
  ingredientGroups: IngredientGroupView[];
  instructions: string[];
  instructionSdk?: RecipeInstructionSdk;
};
