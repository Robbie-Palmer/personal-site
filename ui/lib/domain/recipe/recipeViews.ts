import type { Recipe } from "./recipe";

type BaseRecipeView = {
  slug: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
  image?: string;
  imageAlt?: string;
};

export type RecipeCardView = BaseRecipeView;

export type RecipeDetailView = BaseRecipeView & {
  content: string;
};

export function toRecipeCardView(
  recipe: Recipe,
  tags: string[],
): RecipeCardView {
  return {
    slug: recipe.slug,
    title: recipe.title,
    description: recipe.description,
    date: recipe.date,
    tags,
    image: recipe.image,
    imageAlt: recipe.imageAlt,
  };
}

export function toRecipeDetailView(
  recipe: Recipe,
  tags: string[],
): RecipeDetailView {
  return {
    ...toRecipeCardView(recipe, tags),
    content: recipe.content,
  };
}
