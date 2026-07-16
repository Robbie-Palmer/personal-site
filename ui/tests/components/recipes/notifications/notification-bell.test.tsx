import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationPage } from "@/lib/api/notifications";

const mocks = vi.hoisted(() => ({
  useSession: vi.fn(),
  getNotificationPage: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: mocks.useSession },
}));

vi.mock("@/lib/api/notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/notifications")>()),
  getNotificationPage: mocks.getNotificationPage,
}));

import { NotificationBell } from "@/components/recipes/notifications/notification-bell";

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useSession.mockReturnValue({ data: { user: { id: "user-1" } } });
    mocks.getNotificationPage.mockResolvedValue({
      items: [],
      nextOffset: null,
      unreadCount: 5,
    });
  });

  it("does not refetch or flicker when the same user's session object refreshes", async () => {
    const { rerender } = render(<NotificationBell />);
    expect(
      await screen.findByRole("link", { name: "Notifications, 5 unread" }),
    ).toBeInTheDocument();

    mocks.useSession.mockReturnValue({ data: { user: { id: "user-1" } } });
    rerender(<NotificationBell />);

    expect(mocks.getNotificationPage).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("link", { name: "Notifications, 5 unread" }),
    ).toBeInTheDocument();
  });

  it("hides the previous account's count while a replacement account loads", async () => {
    let resolveReplacement: ((page: NotificationPage) => void) | undefined;
    const replacementPage = new Promise<NotificationPage>((resolve) => {
      resolveReplacement = resolve;
    });
    mocks.getNotificationPage
      .mockResolvedValueOnce({
        items: [],
        nextOffset: null,
        unreadCount: 5,
      })
      .mockReturnValueOnce(replacementPage);
    const { rerender } = render(<NotificationBell />);
    expect(
      await screen.findByRole("link", { name: "Notifications, 5 unread" }),
    ).toBeInTheDocument();

    mocks.useSession.mockReturnValue({ data: { user: { id: "user-2" } } });
    rerender(<NotificationBell />);

    expect(
      screen.getByRole("link", { name: "Notifications" }),
    ).toBeInTheDocument();
    resolveReplacement?.({ items: [], nextOffset: null, unreadCount: 2 });
    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: "Notifications, 2 unread" }),
      ).toBeInTheDocument(),
    );
  });
});
