import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type DietProfile,
  getDietOptions,
  getDietProfile,
  saveDietProfile,
} from "@/lib/api/diet";

const profile: DietProfile = {
  presetDietKeys: ["vegetarian"],
  excludedIngredientSlugs: ["peanut"],
  excludedGroupKeys: [],
  recipeMatchMode: "warn",
};

describe("diet API client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the diet profile and options with the shared request policy", async () => {
    const options = { presets: [], groups: [], ingredients: [] };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json(profile))
      .mockResolvedValueOnce(Response.json(options));

    await expect(getDietProfile()).resolves.toEqual(profile);
    await expect(getDietOptions()).resolves.toEqual(options);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/profile/diet", {
      credentials: "same-origin",
      signal: undefined,
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/profile/diet/options", {
      credentials: "same-origin",
      signal: undefined,
    });
  });

  it("saves a JSON-encoded diet profile", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json(profile));

    await expect(saveDietProfile(profile)).resolves.toEqual(profile);
    expect(fetchMock).toHaveBeenCalledWith("/api/profile/diet", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(profile),
      signal: undefined,
    });
  });

  it("keeps validation paths and status on failures", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        {
          error: "Invalid request body",
          details: [{ path: ["presetDietKeys", 0], message: "Unknown diet" }],
        },
        { status: 400 },
      ),
    );

    await expect(saveDietProfile(profile)).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
      message: "presetDietKeys.0: Unknown diet",
      details: [{ path: ["presetDietKeys", 0], message: "Unknown diet" }],
    });
  });
});
