import { ApiError, apiRequest } from "@/lib/api/http";
import type { SavedRecipeApiRecord } from "@/lib/domain/recipe/recipeDraft";

const PAGE_LIMIT = 100;
const MAX_PAGES = 100;

type SavedRecipesPage = {
  items: SavedRecipeApiRecord[];
  nextCursor: string | null;
};

/**
 * Fetch every saved recipe the caller can read, following the recipe API's
 * limit/cursor pagination until the last page.
 */
export async function fetchAllSavedRecipes(options?: {
  scope?: "owned";
  signal?: AbortSignal;
}): Promise<SavedRecipeApiRecord[]> {
  const records: SavedRecipeApiRecord[] = [];
  let cursor: string | null = null;
  let pages = 0;
  do {
    // Bound the walk so a buggy nextCursor can never loop the browser forever.
    pages += 1;
    if (pages > MAX_PAGES) {
      throw new ApiError("Saved recipes unavailable", 422);
    }
    const params = new URLSearchParams({ limit: String(PAGE_LIMIT) });
    if (options?.scope) params.set("scope", options.scope);
    if (cursor) params.set("cursor", cursor);
    const page = await apiRequest<SavedRecipesPage>(`/api/recipes?${params}`, {
      cache: "no-store",
      signal: options?.signal,
      fallbackMessage: "Saved recipes unavailable",
    });
    records.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return records;
}

export async function getSavedRecipe(
  slug: string,
  signal?: AbortSignal,
): Promise<SavedRecipeApiRecord> {
  try {
    return await apiRequest(`/api/recipes/${encodeURIComponent(slug)}`, {
      signal,
      fallbackMessage: "The recipe could not be loaded.",
    });
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 404) {
        throw new ApiError(
          "That recipe was not found, or it belongs to another profile.",
          error.status,
          { code: error.code, details: error.details },
        );
      }
      if (error.status >= 400) throw error;
      throw new ApiError("The recipe could not be loaded.", 422, {
        code: error.code,
        details: error.details,
      });
    }
    throw error;
  }
}
