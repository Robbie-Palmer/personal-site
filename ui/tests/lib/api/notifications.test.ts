import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAllNotifications,
  getNotificationPage,
} from "@/lib/api/notifications";

describe("notification API client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("clears all notifications through the same-origin proxy", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    await expect(clearAllNotifications()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith("/api/notifications/clear-all", {
      method: "POST",
      credentials: "same-origin",
    });
  });

  it("loads a requested archive page", async () => {
    const page = { items: [], nextOffset: null };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json(page));

    await expect(getNotificationPage(100)).resolves.toEqual(page);
    expect(fetchMock).toHaveBeenCalledWith("/api/notifications?offset=100", {
      credentials: "same-origin",
      signal: undefined,
    });
  });
});
