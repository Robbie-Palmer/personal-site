import type { SavedRecipeApiRecord } from "@/lib/domain/recipe/recipeDraft";

export type DiscoverFeedScope = "public" | "household";

export type DiscoverFeedItem = {
  type: "recipe_added";
  recipe: SavedRecipeApiRecord;
  author: { id: string; name: string; image: string | null };
  createdAt: string;
};

export type DiscoverFeedPage = {
  items: DiscoverFeedItem[];
  nextCursor: string | null;
};

export async function getDiscoverFeedPage(
  scope: DiscoverFeedScope,
  cursor: string | null,
  signal?: AbortSignal,
): Promise<DiscoverFeedPage> {
  const params = new URLSearchParams({ scope });
  if (cursor) params.set("cursor", cursor);
  const response = await fetch(`/api/recipes/discover/feed?${params}`, {
    credentials: "same-origin",
    signal,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? "The feed could not be loaded.");
  }
  return response.json() as Promise<DiscoverFeedPage>;
}
