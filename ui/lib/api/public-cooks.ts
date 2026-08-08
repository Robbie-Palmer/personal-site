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
  followers: PublicCookConnection[];
  following: PublicCookConnection[];
  activity: Array<{
    type: "recipe_added";
    recipe: SavedRecipeApiRecord;
    createdAt: string;
  }>;
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

export function getCookFollowStatus(id: string, signal?: AbortSignal) {
  return apiJson<CookFollowStatus>(
    `/api/recipes/cooks/${encodeURIComponent(id)}/follow`,
    signal,
  );
}

export async function setCookFollowing(id: string, following: boolean) {
  const response = await fetch(
    `/api/recipes/cooks/${encodeURIComponent(id)}/follow`,
    {
      method: following ? "PUT" : "DELETE",
      credentials: "same-origin",
    },
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(
      body?.error ??
        (following
          ? "This cook could not be followed."
          : "This cook could not be unfollowed."),
    );
  }
  return response.json() as Promise<CookFollowStatus>;
}
