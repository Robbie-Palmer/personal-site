import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getCookingInsights,
  recordCookingSession,
} from "@/lib/api/cooking-insights";

describe("cooking insights API", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the user's cook log", async () => {
    const insights = {
      cookModeStarts: 3,
      mealsCooked: 2,
      distinctRecipesCooked: 1,
      recent: [],
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json(insights));

    await expect(getCookingInsights()).resolves.toEqual(insights);
    expect(fetchMock).toHaveBeenCalledWith("/api/profile/cooking-insights", {
      credentials: "same-origin",
      signal: undefined,
    });
  });

  it("records start and completion events through the same idempotent session", async () => {
    const cookingSession = {
      id: "2f64837b-3f3e-4c18-ae39-35df6808dc6c",
      recipeSlug: "weeknight-pasta",
      recipeTitle: "Weeknight pasta",
      servings: 2,
      startedAt: "2026-07-28T17:30:00.000Z",
      completedAt: null,
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ cookingSession }));
    const event = {
      sessionId: cookingSession.id,
      recipeSlug: cookingSession.recipeSlug,
      recipeTitle: cookingSession.recipeTitle,
      servings: cookingSession.servings,
      event: "started" as const,
    };

    await expect(recordCookingSession(event)).resolves.toEqual(cookingSession);
    expect(fetchMock).toHaveBeenCalledWith("/api/profile/cooking-insights", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
      keepalive: true,
    });
  });

  it("surfaces API errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        { error: "Cooking history is unavailable" },
        { status: 503 },
      ),
    );

    await expect(getCookingInsights()).rejects.toMatchObject({
      message: "Cooking history is unavailable",
      status: 503,
    });
  });
});
