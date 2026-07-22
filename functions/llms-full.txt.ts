import { decodeRecipePayload, recipeMarkdown } from "./lib/public-recipes";
import {
  augmentRecipeAsset,
  type RecipeAssetContext,
} from "./lib/recipe-asset";

export const onRequest = async (
  context: RecipeAssetContext,
): Promise<Response> =>
  augmentRecipeAsset(context, (asset, records) => {
    const recipes = records
      .flatMap((record) => {
        const payload = decodeRecipePayload(record);
        return payload ? [payload] : [];
      })
      .sort((left, right) =>
        left.recipe.title.localeCompare(right.recipe.title),
      );
    if (recipes.length === 0) return asset;
    return `${asset.trimEnd()}\n\n${recipes.map(recipeMarkdown).join("\n\n")}`;
  });
