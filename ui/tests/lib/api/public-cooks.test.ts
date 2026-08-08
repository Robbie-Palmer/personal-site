import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCookFollowStatus,
  getPublicCook,
  getPublicCooks,
  setCookFollowing,
} from "@/lib/api/public-cooks";

describe("public cooks API client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads cook summaries, profiles, and follow status", async () => {
    const summary = {
      id: "cook-1",
      name: "Ada Cook",
      image: null,
      activityCount: 1,
      latestRecipeTitle: "Ada's Stew",
    };
    const profile = {
      id: "cook-1",
      name: "Ada Cook",
      image: null,
      followersCount: 0,
      followingCount: 0,
      followers: [],
      following: [],
      activity: [],
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ cooks: [summary] }))
      .mockResolvedValueOnce(Response.json({ cook: profile }))
      .mockResolvedValueOnce(
        Response.json({ following: false, canFollow: true }),
      );
    const signal = new AbortController().signal;

    await expect(getPublicCooks(signal)).resolves.toEqual([summary]);
    await expect(getPublicCook("cook 1", signal)).resolves.toEqual(profile);
    await expect(getCookFollowStatus("cook 1", signal)).resolves.toEqual({
      following: false,
      canFollow: true,
    });
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/recipes/cooks", {
      credentials: "same-origin",
      signal,
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/recipes/cooks?cook=cook%201",
      { credentials: "same-origin", signal },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/recipes/cooks/cook%201/follow",
      { credentials: "same-origin", signal },
    );
  });

  it("follows and unfollows through the same-origin proxy", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({ following: true, canFollow: true }),
      )
      .mockResolvedValueOnce(
        Response.json({ following: false, canFollow: true }),
      );

    await expect(setCookFollowing("cook 1", true)).resolves.toEqual({
      following: true,
      canFollow: true,
    });
    await expect(setCookFollowing("cook 1", false)).resolves.toEqual({
      following: false,
      canFollow: true,
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/recipes/cooks/cook%201/follow",
      { method: "PUT", credentials: "same-origin" },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/recipes/cooks/cook%201/follow",
      { method: "DELETE", credentials: "same-origin" },
    );
  });

  it("surfaces API errors and fallbacks", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({ error: "Cooks are unavailable" }, { status: 503 }),
      )
      .mockResolvedValueOnce(
        new Response("not json", {
          status: 503,
          headers: { "content-type": "text/plain" },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ error: "Follow failed" }, { status: 409 }),
      )
      .mockResolvedValueOnce(
        new Response("not json", {
          status: 503,
          headers: { "content-type": "text/plain" },
        }),
      );

    await expect(getPublicCooks()).rejects.toThrow("Cooks are unavailable");
    await expect(getCookFollowStatus("cook-1")).rejects.toThrow(
      "The cooks directory could not be loaded.",
    );
    await expect(setCookFollowing("cook-1", true)).rejects.toThrow(
      "Follow failed",
    );
    await expect(setCookFollowing("cook-1", false)).rejects.toThrow(
      "This cook could not be unfollowed.",
    );
  });
});
