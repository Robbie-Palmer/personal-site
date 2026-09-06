import { afterEach, describe, expect, it, vi } from "vitest";
import {
  listPublicRecipes,
  loadPublicRecipe,
} from "../../../functions/lib/public-recipes";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("public recipe API failures", () => {
  it("records recipe-list network failures", async () => {
    const error = new TypeError("network unavailable");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(
      listPublicRecipes({ RECIPE_API_URL: "https://api.example.test" }),
    ).resolves.toBeNull();

    expect(consoleError).toHaveBeenCalledWith(
      "Public recipe list request failed",
      error,
    );
  });

  it("records unexpected recipe-list response statuses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(
      listPublicRecipes({ RECIPE_API_URL: "https://api.example.test" }),
    ).resolves.toBeNull();

    expect(consoleError).toHaveBeenCalledWith(
      "Public recipe list request failed",
      {
        status: 503,
        url: "https://api.example.test/recipes?limit=100",
      },
    );
  });

  it("records unexpected recipe response statuses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(
      loadPublicRecipe(
        { RECIPE_API_URL: "https://api.example.test" },
        "tomato-pasta",
      ),
    ).resolves.toBeNull();

    expect(consoleError).toHaveBeenCalledWith("Public recipe request failed", {
      status: 503,
      url: "https://api.example.test/recipes/tomato-pasta",
    });
  });

  it("treats a missing recipe as an expected miss", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(
      loadPublicRecipe(
        { RECIPE_API_URL: "https://api.example.test" },
        "missing-recipe",
      ),
    ).resolves.toBeNull();

    expect(consoleError).not.toHaveBeenCalled();
  });
});
