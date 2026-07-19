import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAllSavedRecipes } from "@/lib/api/saved-recipes";

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
});
