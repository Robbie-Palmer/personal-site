import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getRecipeBoxProfile,
  saveRecipeBoxProfile,
} from "@/lib/api/recipe-box";

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, { status });
}

describe("recipe box API", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the current recipe box", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        jsonResponse({ completed: true, recipeSlugs: ["lentil-soup"] }),
      );
    const controller = new AbortController();

    await expect(getRecipeBoxProfile(controller.signal)).resolves.toEqual({
      completed: true,
      recipeSlugs: ["lentil-soup"],
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/profile/recipe-box", {
      credentials: "same-origin",
      signal: controller.signal,
    });
  });

  it("supports legacy and empty recipe-box responses", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({ completed: false, staticRecipeSlugs: ["starter"] }),
      )
      .mockResolvedValueOnce(jsonResponse({ completed: false }));

    await expect(getRecipeBoxProfile()).resolves.toEqual({
      completed: false,
      recipeSlugs: ["starter"],
    });
    await expect(getRecipeBoxProfile()).resolves.toEqual({
      completed: false,
      recipeSlugs: [],
    });
  });

  it("saves the selected recipe slugs", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        jsonResponse({ completed: true, recipeSlugs: ["selected"] }),
      );

    await expect(saveRecipeBoxProfile(["selected"])).resolves.toEqual({
      completed: true,
      recipeSlugs: ["selected"],
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/profile/recipe-box", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recipeSlugs: ["selected"] }),
    });
  });

  it("uses API and fallback errors for unsuccessful responses", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({ error: "Choose fewer recipes." }, 400),
      )
      .mockResolvedValueOnce(new Response("not json", { status: 500 }));

    await expect(getRecipeBoxProfile()).rejects.toThrow(
      "Choose fewer recipes.",
    );
    await expect(getRecipeBoxProfile()).rejects.toThrow(
      "Recipe box request failed.",
    );
  });
});
