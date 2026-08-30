import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAllNotifications,
  getNotificationPage,
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  performNotificationAction,
  updateNotification,
} from "@/lib/api/notifications";

describe("notification API client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
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
    const page = { items: [], nextOffset: null, unreadCount: 0 };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json(page));

    await expect(getNotificationPage(100)).resolves.toEqual(page);
    expect(fetchMock).toHaveBeenCalledWith("/api/notifications?offset=100", {
      credentials: "same-origin",
      signal: undefined,
    });
  });

  it("loads the first page as a notification list", async () => {
    const items = [{ id: "notification-1" }];
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ items, nextOffset: null, unreadCount: 1 }),
    );

    await expect(getNotifications()).resolves.toEqual(items);
  });

  it("loads only the unread notification count for the bell", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ unreadCount: 7 }));

    await expect(getUnreadNotificationCount()).resolves.toBe(7);
    expect(fetchMock).toHaveBeenCalledWith("/api/notifications/unread-count", {
      credentials: "same-origin",
      signal: undefined,
    });
  });

  it("updates one notification and marks the archive read", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    await updateNotification("notification-1", { read: true });
    await markAllNotificationsRead();

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/notifications/notification-1",
      {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ read: true }),
      },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/notifications/read-all",
      { method: "POST", credentials: "same-origin" },
    );
  });

  it("performs a notification action through the generic action route", async () => {
    const item = { id: "notification-1" };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ item }));

    await expect(
      performNotificationAction("notification-1", "accept"),
    ).resolves.toEqual(item);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/notifications/notification-1/actions/accept",
      { method: "POST", credentials: "same-origin" },
    );
  });
});
