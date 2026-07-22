import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchAllSavedRecipes,
  fetchRecipeBoxRecipes,
} from "@/lib/api/saved-recipes";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("fetchAllSavedRecipes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("follows nextCursor until the last page", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({ items: [{ slug: "first" }], nextCursor: "cursor-1" }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ items: [{ slug: "second" }], nextCursor: null }),
      );

    const records = await fetchAllSavedRecipes();

    expect(records.map((record) => record.slug)).toEqual(["first", "second"]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/recipes?limit=100",
      expect.objectContaining({ credentials: "same-origin" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/recipes?limit=100&cursor=cursor-1",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("passes the owned scope through", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ items: [], nextCursor: null }));

    await fetchAllSavedRecipes({ scope: "owned", credentials: "include" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/recipes?limit=100&scope=owned",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("throws when a page request fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("nope", { status: 502 }),
    );

    await expect(fetchAllSavedRecipes()).rejects.toThrow(
      "Saved recipes unavailable",
    );
  });

  it("combines owned recipes with starters before onboarding is complete", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({ items: [{ slug: "owned" }], nextCursor: null }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [{ slug: "owned" }, { slug: "starter" }],
          nextCursor: null,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ completed: false, recipeSlugs: [] }),
      );

    const result = await fetchRecipeBoxRecipes();

    expect(result.recipes.map((recipe) => recipe.slug)).toEqual([
      "owned",
      "starter",
    ]);
    expect(result.box.completed).toBe(false);
  });

  it("limits completed recipe boxes to owned and selected recipes", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({ items: [{ slug: "owned" }], nextCursor: null }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            { slug: "owned" },
            { slug: "selected" },
            { slug: "not-selected" },
          ],
          nextCursor: null,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ completed: true, recipeSlugs: ["selected"] }),
      );

    const result = await fetchRecipeBoxRecipes();

    expect(result.recipes.map((recipe) => recipe.slug)).toEqual([
      "owned",
      "selected",
    ]);
  });

  it("bounds pagination when an API repeats its cursor", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      jsonResponse({ items: [], nextCursor: "same-cursor" }),
    );

    await expect(fetchAllSavedRecipes()).rejects.toThrow(
      "Saved recipes unavailable",
    );
  });
});
