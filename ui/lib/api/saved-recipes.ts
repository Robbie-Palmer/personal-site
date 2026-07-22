import type { RecipeBoxProfile } from "@/lib/api/recipe-box";
import { getRecipeBoxProfile } from "@/lib/api/recipe-box";
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
  credentials?: RequestCredentials;
}): Promise<SavedRecipeApiRecord[]> {
  const records: SavedRecipeApiRecord[] = [];
  let cursor: string | null = null;
  let pages = 0;
  do {
    // Bound the walk so a buggy nextCursor can never loop the browser forever.
    pages += 1;
    if (pages > MAX_PAGES) throw new Error("Saved recipes unavailable");
    const params = new URLSearchParams({ limit: String(PAGE_LIMIT) });
    if (options?.scope) params.set("scope", options.scope);
    if (cursor) params.set("cursor", cursor);
    const response = await fetch(`/api/recipes?${params}`, {
      cache: "no-store",
      credentials: options?.credentials ?? "same-origin",
      signal: options?.signal,
    });
    if (!response.ok) throw new Error("Saved recipes unavailable");
    const page = (await response.json()) as SavedRecipesPage;
    records.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return records;
}

export async function fetchRecipeBoxRecipes(
  signal?: AbortSignal,
): Promise<{ recipes: SavedRecipeApiRecord[]; box: RecipeBoxProfile }> {
  const [owned, readable, box] = await Promise.all([
    fetchAllSavedRecipes({ scope: "owned", signal }),
    fetchAllSavedRecipes({ signal }),
    getRecipeBoxProfile(signal),
  ]);
  const ownedSlugs = new Set(owned.map((recipe) => recipe.slug));
  const selectedSlugs = new Set(box.recipeSlugs);
  const selectedOrStarterRecipes = readable.filter(
    (recipe) =>
      !ownedSlugs.has(recipe.slug) &&
      (!box.completed || selectedSlugs.has(recipe.slug)),
  );
  return { recipes: [...owned, ...selectedOrStarterRecipes], box };
}
