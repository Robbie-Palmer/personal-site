import type { SavedRecipeApiRecord } from "@/lib/domain/recipe/recipeDraft";

export type PublicCookSummary = {
  id: string;
  name: string;
  image: string | null;
  activityCount: number;
  latestRecipeTitle: string;
};

export type PublicCookProfile = {
  id: string;
  name: string;
  image: string | null;
  activity: Array<{
    type: "recipe_added";
    recipe: SavedRecipeApiRecord;
    createdAt: string;
  }>;
};

async function apiJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    signal,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? "The cooks directory could not be loaded.");
  }
  return response.json() as Promise<T>;
}

export async function getPublicCooks(signal?: AbortSignal) {
  const page = await apiJson<{ cooks: PublicCookSummary[] }>(
    "/api/recipes/cooks",
    signal,
  );
  return page.cooks;
}

export async function getPublicCook(id: string, signal?: AbortSignal) {
  const page = await apiJson<{ cook: PublicCookProfile | null }>(
    `/api/recipes/cooks?cook=${encodeURIComponent(id)}`,
    signal,
  );
  return page.cook;
}
