import { apiRequest } from "@/lib/api/http";
import type { SavedRecipeApiRecord } from "@/lib/domain/recipe/recipeDraft";

export type DiscoverFeedScope = "public" | "following";

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
  limit?: number,
): Promise<DiscoverFeedPage> {
  const params = new URLSearchParams({ scope });
  if (cursor) params.set("cursor", cursor);
  if (limit !== undefined) params.set("limit", String(limit));
  return apiRequest(`/api/recipes/discover/feed?${params}`, {
    signal,
    fallbackMessage: "The feed could not be loaded.",
  });
}
