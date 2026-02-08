import type { Ingredient, IngredientSlug } from "./ingredient";
import type { IngredientGroup, Recipe, RecipeIngredient } from "./recipe";
import type { RecipeRepository } from "./recipeRepository";
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
  tags: string[];
  servings: number;
  prepTime?: number;
  cookTime?: number;
  totalTime?: number;
  image?: string;
  imageAlt?: string;
};

export type RecipeCardView = BaseRecipeView;

export type RecipeDetailView = BaseRecipeView & {
  ingredientGroups: IngredientGroupView[];
  instructions: string[];
};

function toIngredientView(
  item: RecipeIngredient,
  ingredients: Map<IngredientSlug, Ingredient>,
): RecipeIngredientView {
  const ingredient = ingredients.get(item.ingredient);
  return {
    ingredient: item.ingredient,
    name: ingredient?.name ?? item.ingredient,
    pluralName: ingredient?.pluralName,
    category: ingredient?.category,
    amount: item.amount,
    unit: item.unit,
    preparation: item.preparation,
    note: item.note,
  };
}

function toIngredientGroupView(
  group: IngredientGroup,
  ingredients: Map<IngredientSlug, Ingredient>,
): IngredientGroupView {
  return {
    name: group.name,
    items: group.items.map((item) => toIngredientView(item, ingredients)),
  };
}

function computeTotalTime(recipe: Recipe): number | undefined {
  if (recipe.prepTime != null && recipe.cookTime != null) {
    return recipe.prepTime + recipe.cookTime;
  }
  return recipe.prepTime ?? recipe.cookTime;
}

export function toRecipeCardView(recipe: Recipe): RecipeCardView {
  return {
    slug: recipe.slug,
    title: recipe.title,
    description: recipe.description,
    date: recipe.date,
    tags: recipe.tags,
    servings: recipe.servings,
    prepTime: recipe.prepTime,
    cookTime: recipe.cookTime,
    totalTime: computeTotalTime(recipe),
    image: recipe.image,
    imageAlt: recipe.imageAlt,
  };
}

export function toRecipeDetailView(
  recipe: Recipe,
  repository: RecipeRepository,
): RecipeDetailView {
  return {
    ...toRecipeCardView(recipe),
    ingredientGroups: recipe.ingredientGroups.map((group) =>
      toIngredientGroupView(group, repository.ingredients),
    ),
    instructions: recipe.instructions,
  };
}
