import type { PublicRecipeEnv, StoredRecipe } from "./public-recipes";
import { listPublicRecipes } from "./public-recipes";

export interface RecipeAssetContext {
  request: Request;
  env: PublicRecipeEnv & { ASSETS: { fetch: typeof fetch } };
}

export function rewrittenRecipeAssetHeaders(
  asset: Response,
  cacheControl = "public, max-age=60, s-maxage=300",
): Headers {
  const headers = new Headers(asset.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.delete("etag");
  headers.delete("last-modified");
  headers.set("cache-control", cacheControl);
  return headers;
}

export async function augmentRecipeAsset(
  context: RecipeAssetContext,
  render: (assetBody: string, recipes: StoredRecipe[], url: URL) => string,
): Promise<Response> {
  const asset = await context.env.ASSETS.fetch(context.request);
  if (!asset.ok || context.request.method === "HEAD") return asset;

  const recipes = await listPublicRecipes(context.env);
  if (!recipes) return asset;

  const body = render(await asset.text(), recipes, new URL(context.request.url));
  const headers = rewrittenRecipeAssetHeaders(asset);
  return new Response(body, { status: asset.status, headers });
}
