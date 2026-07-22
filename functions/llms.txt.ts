import { decodeRecipePayload } from "./lib/public-recipes";
import {
  augmentRecipeAsset,
  type RecipeAssetContext,
} from "./lib/recipe-asset";

function escapeMarkdownInline(value: string): string {
  return value
    .replaceAll(/\s+/g, " ")
    .replaceAll(/([\\[\]])/g, String.raw`\$1`)
    .trim();
}

export const onRequest = async (
  context: RecipeAssetContext,
): Promise<Response> =>
  augmentRecipeAsset(context, (asset, records, url) => {
    const recipes = records
      .flatMap((record) => {
        const payload = decodeRecipePayload(record);
        return payload ? [{ record, recipe: payload.recipe }] : [];
      })
      .sort((left, right) =>
        left.recipe.title.localeCompare(right.recipe.title),
      );
    if (recipes.length === 0) return asset;

    const entries = recipes.map(({ record, recipe }) => {
      const description = recipe.description
        ? `: ${escapeMarkdownInline(recipe.description)}`
        : "";
      return `- [${escapeMarkdownInline(recipe.title)}](${url.origin}/recipes/${encodeURIComponent(record.slug)}.md)${description}`;
    });
    return `${asset.trimEnd()}\n\n### Public recipes\n\n${entries.join("\n")}\n`;
  });
