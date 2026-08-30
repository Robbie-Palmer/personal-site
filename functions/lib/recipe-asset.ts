import type { PublicRecipeEnv, StoredRecipe } from "./public-recipes";
import { isStoredRecipe, listPublicRecipes } from "./public-recipes";

const PUBLIC_RECIPE_CACHE_NAME = "recipe-assets-v1";
const PUBLIC_RECIPE_CACHE_PATH = "/__recipe-assets/public-recipes.json";
const PUBLIC_RECIPE_CACHE_CREATED_AT_HEADER = "x-recipe-cache-created-at";
const PUBLIC_RECIPE_CACHE_TTL_SECONDS = 5 * 60;
const pendingRecipeLists = new Map<
  string,
  Promise<StoredRecipe[] | null>
>();

type PublicRecipeList = {
  records: StoredRecipe[] | null;
  cacheSeconds: number;
};

export interface RecipeAssetContext {
  request: Request;
  env: PublicRecipeEnv & { ASSETS: { fetch: typeof fetch } };
  waitUntil?: (promise: Promise<unknown>) => void;
}

function publicRecipeCacheKey(request: Request): Request {
  const url = new URL(PUBLIC_RECIPE_CACHE_PATH, request.url);
  return new Request(url, { method: "GET" });
}

async function openPublicRecipeCache(): Promise<Cache | null> {
  const storage = Reflect.get(globalThis, "caches") as
    | CacheStorage
    | undefined;
  if (!storage || typeof storage.open !== "function") return null;
  try {
    return await storage.open(PUBLIC_RECIPE_CACHE_NAME);
  } catch {
    return null;
  }
}

async function readCachedPublicRecipes(
  cache: Cache,
  cacheKey: Request,
): Promise<PublicRecipeList | null> {
  try {
    const response = await cache.match(cacheKey);
    if (!response) return null;
    const value: unknown = await response.json();
    if (
      !Array.isArray(value) ||
      !value.every(
        (item) => isStoredRecipe(item) && item.visibility === "public",
      )
    ) {
      return null;
    }
    const createdAtHeader = response.headers.get(
      PUBLIC_RECIPE_CACHE_CREATED_AT_HEADER,
    );
    const createdAt = createdAtHeader ? Number(createdAtHeader) : Number.NaN;
    const ageSeconds = Number.isFinite(createdAt)
      ? Math.max(0, Math.floor((Date.now() - createdAt) / 1_000))
      : PUBLIC_RECIPE_CACHE_TTL_SECONDS;
    return {
      records: value,
      cacheSeconds: Math.max(
        0,
        PUBLIC_RECIPE_CACHE_TTL_SECONDS - ageSeconds,
      ),
    };
  } catch {
    return null;
  }
}

function cachePublicRecipes(
  cache: Cache | null,
  cacheKey: Request,
  recipes: Promise<StoredRecipe[] | null>,
): Promise<void> {
  return recipes
    .then(async (records) => {
      if (!cache || !records) return;
      const response = Response.json(records, {
        headers: {
          "cache-control": `public, s-maxage=${PUBLIC_RECIPE_CACHE_TTL_SECONDS}`,
          [PUBLIC_RECIPE_CACHE_CREATED_AT_HEADER]: String(Date.now()),
        },
      });
      await cache.put(cacheKey, response);
    })
    .catch(() => undefined)
    .finally(() => {
      if (pendingRecipeLists.get(cacheKey.url) === recipes) {
        pendingRecipeLists.delete(cacheKey.url);
      }
    });
}

async function publicRecipesForAsset(
  context: RecipeAssetContext,
): Promise<PublicRecipeList> {
  const cacheKey = publicRecipeCacheKey(context.request);
  const cache = await openPublicRecipeCache();
  if (cache) {
    const cached = await readCachedPublicRecipes(cache, cacheKey);
    if (cached) return cached;
  }

  const pending = pendingRecipeLists.get(cacheKey.url);
  if (pending) {
    return {
      records: await pending,
      cacheSeconds: PUBLIC_RECIPE_CACHE_TTL_SECONDS,
    };
  }

  const recipes = listPublicRecipes(context.env);
  pendingRecipeLists.set(cacheKey.url, recipes);
  const cacheWrite = cachePublicRecipes(cache, cacheKey, recipes);
  if (context.waitUntil) {
    context.waitUntil(cacheWrite);
  } else {
    await cacheWrite;
  }
  return {
    records: await recipes,
    cacheSeconds: PUBLIC_RECIPE_CACHE_TTL_SECONDS,
  };
}

function recipeAssetCacheControl(cacheSeconds: number): string {
  const browserSeconds = Math.min(60, cacheSeconds);
  return `public, max-age=${browserSeconds}, s-maxage=${cacheSeconds}`;
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

  const { records, cacheSeconds } = await publicRecipesForAsset(context);
  if (!records) return asset;

  const body = render(
    await asset.text(),
    records,
    new URL(context.request.url),
  );
  const headers = rewrittenRecipeAssetHeaders(
    asset,
    recipeAssetCacheControl(cacheSeconds),
  );
  return new Response(body, { status: asset.status, headers });
}
