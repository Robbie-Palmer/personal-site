import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearAllNotifications } from "@/lib/api/notifications";

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
});
