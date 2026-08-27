import { afterEach, describe, expect, it, vi } from "vitest";
import { getRecipeBootstrap } from "@/lib/api/recipe-bootstrap";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getRecipeBootstrap", () => {
  it("loads profile data once and selects the recipes in a completed box", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        recipeBox: {
          ownedRecipes: [{ slug: "owned" }],
          readableRecipes: [
            { slug: "owned" },
            { slug: "selected" },
            { slug: "not-selected" },
          ],
          profile: { completed: true, recipeSlugs: ["selected"] },
        },
        diet: {
          profile: {
            presetDietKeys: [],
            excludedIngredientSlugs: [],
            excludedGroupKeys: [],
            recipeMatchMode: "hide",
          },
          options: { presets: [], groups: [], ingredients: [] },
        },
        unreadNotificationCount: 3,
      }),
    );

    const bootstrap = await getRecipeBootstrap();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/profile/bootstrap",
      expect.objectContaining({ credentials: "same-origin" }),
    );
    expect(bootstrap.recipeBox.recipes.map((recipe) => recipe.slug)).toEqual([
      "owned",
      "selected",
    ]);
    expect(bootstrap.unreadNotificationCount).toBe(3);
  });

  it("includes all readable starter recipes before onboarding completes", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        recipeBox: {
          ownedRecipes: [{ slug: "owned" }],
          readableRecipes: [{ slug: "owned" }, { slug: "starter" }],
          profile: { completed: false, recipeSlugs: [] },
        },
        diet: { profile: {}, options: {} },
        unreadNotificationCount: 0,
      }),
    );

    const bootstrap = await getRecipeBootstrap();

    expect(bootstrap.recipeBox.recipes.map((recipe) => recipe.slug)).toEqual([
      "owned",
      "starter",
    ]);
  });
});
