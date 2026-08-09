import { apiRequest } from "@/lib/api/http";
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
} & CookConnections;

export type CookConnections = {
  followersCount: number;
  followingCount: number;
  followers: PublicCookConnection[];
  following: PublicCookConnection[];
};

export type PublicCookConnection = {
  id: string;
  name: string;
  image: string | null;
};

export type CookFollowStatus = {
  following: boolean;
  canFollow: boolean;
};

async function apiJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  return apiRequest(url, {
    signal,
    fallbackMessage: "The cooks directory could not be loaded.",
  });
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

export function getCookFollowStatus(id: string, signal?: AbortSignal) {
  return apiJson<CookFollowStatus>(
    `/api/recipes/cooks/${encodeURIComponent(id)}/follow`,
    signal,
  );
}

export function getOwnCookConnections(signal?: AbortSignal) {
  return apiJson<CookConnections>("/api/recipes/cooks/me/connections", signal);
}

export async function setCookFollowing(id: string, following: boolean) {
  return apiRequest<CookFollowStatus>(
    `/api/recipes/cooks/${encodeURIComponent(id)}/follow`,
    {
      method: following ? "PUT" : "DELETE",
      fallbackMessage: following
        ? "This cook could not be followed."
        : "This cook could not be unfollowed.",
    },
  );
}
