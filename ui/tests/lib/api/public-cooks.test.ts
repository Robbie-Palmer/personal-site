import { afterEach, describe, expect, it, vi } from "vitest";
import { getPublicCook, getPublicCooks } from "@/lib/api/public-cooks";

describe("public cooks API", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads lightweight cook summaries", async () => {
    const cooks = [
      {
        id: "cook-1",
        name: "Ada Cook",
        image: null,
        activityCount: 2,
        latestRecipeTitle: "Ada's Stew",
      },
    ];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ cooks }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(getPublicCooks()).resolves.toEqual(cooks);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/recipes/cooks",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("encodes the selected cook id", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ cook: null }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(getPublicCook("cook/one")).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/recipes/cooks?cook=cook%2Fone",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });
});
