import { ApiError } from "@/lib/api/api-error";

export type CookingSession = {
  id: string;
  recipeSlug: string;
  recipeTitle: string;
  servings: number;
  startedAt: string;
  completedAt: string | null;
};

export type CookingInsights = {
  cookModeStarts: number;
  mealsCooked: number;
  distinctRecipesCooked: number;
  recent: CookingSession[];
};

type CookingSessionEvent = {
  sessionId: string;
  recipeSlug: string;
  recipeTitle: string;
  servings: number;
  event: "started" | "completed";
};

async function parseResponse<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new ApiError(body?.error ?? fallbackMessage, response.status);
  }
  return response.json() as Promise<T>;
}

export async function getCookingInsights(
  signal?: AbortSignal,
): Promise<CookingInsights> {
  return parseResponse(
    await fetch("/api/profile/cooking-insights", {
      credentials: "same-origin",
      signal,
    }),
    "Cooking insights could not be loaded.",
  );
}

export async function recordCookingSession(
  event: CookingSessionEvent,
): Promise<CookingSession> {
  const result = await parseResponse<{ cookingSession: CookingSession }>(
    await fetch("/api/profile/cooking-insights", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
      keepalive: true,
    }),
    "Cooking activity could not be saved.",
  );
  return result.cookingSession;
}
