import { afterEach, describe, expect, it, vi } from "vitest";
import { getDiscoverFeedPage } from "@/lib/api/discover-feed";

describe("getDiscoverFeedPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("includes an explicitly provided zero limit", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ items: [], nextCursor: null }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await getDiscoverFeedPage("public", null, undefined, 0);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/recipes/discover/feed?scope=public&limit=0",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });
});
