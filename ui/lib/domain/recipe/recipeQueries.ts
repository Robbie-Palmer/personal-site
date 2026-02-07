import {
  type DomainRepository,
  getContentForTag,
  getNodeSlug,
  getTagsForContent,
  isNodeType,
  makeNodeId,
} from "@/lib/repository";
import type { RecipeSlug } from "./recipe";
import {
  type RecipeCardView,
  type RecipeDetailView,
  toRecipeCardView,
  toRecipeDetailView,
} from "./recipeViews";

export function getRecipeCard(
  repository: DomainRepository,
  slug: RecipeSlug,
): RecipeCardView | null {
  const recipe = repository.recipes.get(slug);
  if (!recipe) return null;

  const tags = getTagsForContent(repository.graph, makeNodeId("recipe", slug));

  return toRecipeCardView(recipe, [...tags]);
}

export function getRecipeDetail(
  repository: DomainRepository,
  slug: RecipeSlug,
): RecipeDetailView | null {
  const recipe = repository.recipes.get(slug);
  if (!recipe) return null;

  const tags = getTagsForContent(repository.graph, makeNodeId("recipe", slug));

  return toRecipeDetailView(recipe, [...tags]);
}

export function getAllRecipeCards(
  repository: DomainRepository,
): RecipeCardView[] {
  const recipeSlugs = Array.from(repository.recipes.keys()) as RecipeSlug[];
  return mapRecipesToRecipeCardViews(repository, recipeSlugs);
}

function mapRecipesToRecipeCardViews(
  repository: DomainRepository,
  recipeSlugs: RecipeSlug[],
): RecipeCardView[] {
  return recipeSlugs
    .map((slug) => repository.recipes.get(slug))
    .filter(
      (recipe): recipe is NonNullable<typeof recipe> => recipe !== undefined,
    )
    .map((recipe) => {
      const tags = getTagsForContent(
        repository.graph,
        makeNodeId("recipe", recipe.slug),
      );
      return toRecipeCardView(recipe, [...tags]);
    });
}

export function getRecipesByTag(
  repository: DomainRepository,
  tag: string,
): RecipeCardView[] {
  const nodeIds = getContentForTag(repository.graph, tag);

  const recipeSlugs = Array.from(nodeIds)
    .filter((nodeId) => isNodeType(nodeId, "recipe"))
    .map((nodeId) => getNodeSlug(nodeId) as RecipeSlug);

  return mapRecipesToRecipeCardViews(repository, recipeSlugs);
}
