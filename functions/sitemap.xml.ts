import { escapeHtmlText } from "recipe-domain/serialization";
import { decodeRecipePayload } from "./lib/public-recipes";
import {
  augmentRecipeAsset,
  type RecipeAssetContext,
} from "./lib/recipe-asset";

export const onRequest = async (
  context: RecipeAssetContext,
): Promise<Response> =>
  augmentRecipeAsset(context, (asset, records, url) => {
    const entries = records.flatMap((record) => {
      if (!decodeRecipePayload(record)) return [];
      const location = escapeHtmlText(
        `${url.origin}/recipes/${encodeURIComponent(record.slug)}`,
      );
      const lastModified = record.updatedAt
        ? `<lastmod>${escapeHtmlText(record.updatedAt)}</lastmod>`
        : "";
      return [
        `<url><loc>${location}</loc>${lastModified}<priority>0.7</priority></url>`,
      ];
    });
    if (entries.length === 0) return asset;
    return asset.replace("</urlset>", `${entries.join("")}\n</urlset>`);
  });
