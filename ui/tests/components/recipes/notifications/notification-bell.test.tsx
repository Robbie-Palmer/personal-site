import { act, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationPage } from "@/lib/api/notifications";
import { render } from "@/tests/test-utils";

const mocks = vi.hoisted(() => ({
  useSession: vi.fn(),
  getNotificationPage: vi.fn(),
  getRecipeBootstrap: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: mocks.useSession },
}));

vi.mock("@/lib/api/notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/notifications")>()),
  getNotificationPage: mocks.getNotificationPage,
}));

vi.mock("@/lib/api/recipe-bootstrap", () => ({
  getRecipeBootstrap: mocks.getRecipeBootstrap,
}));

import { NotificationBell } from "@/components/recipes/notifications/notification-bell";

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    mocks.useSession.mockReturnValue({ data: { user: { id: "user-1" } } });
    mocks.getNotificationPage.mockResolvedValue({
      items: [],
      nextOffset: null,
      unreadCount: 5,
    });
    mocks.getRecipeBootstrap.mockResolvedValue({
      recipeBox: { recipes: [], box: { completed: true, recipeSlugs: [] } },
      diet: { profile: {}, options: {} },
      unreadNotificationCount: 5,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("polls for requests created after the user signs in", async () => {
    vi.useFakeTimers();
    mocks.getRecipeBootstrap.mockResolvedValueOnce({
      recipeBox: { recipes: [], box: { completed: true, recipeSlugs: [] } },
      diet: { profile: {}, options: {} },
      unreadNotificationCount: 0,
    });
    mocks.getNotificationPage.mockResolvedValueOnce({
      items: [],
      nextOffset: null,
      unreadCount: 1,
    });

    render(<NotificationBell />);
    await act(async () => Promise.resolve());
    expect(
      screen.getByRole("link", { name: "Notifications" }),
    ).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(
      screen.getByRole("link", { name: "Notifications, 1 unread" }),
    ).toBeInTheDocument();
  });

  it("pauses notification polling while the tab is hidden", async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });

    render(<NotificationBell />);
    await act(async () => Promise.resolve());
    expect(mocks.getNotificationPage).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });

    expect(mocks.getNotificationPage).not.toHaveBeenCalled();
  });

  it("does not refetch or flicker when the same user's session object refreshes", async () => {
    const { rerender } = render(<NotificationBell />);
    expect(
      await screen.findByRole("link", { name: "Notifications, 5 unread" }),
    ).toBeInTheDocument();

    mocks.useSession.mockReturnValue({ data: { user: { id: "user-1" } } });
    rerender(<NotificationBell />);

    expect(mocks.getNotificationPage).not.toHaveBeenCalled();
    expect(
      screen.getByRole("link", { name: "Notifications, 5 unread" }),
    ).toBeInTheDocument();
  });

  it("hides the previous account's count while a replacement account loads", async () => {
    let resolveReplacement: ((page: NotificationPage) => void) | undefined;
    const replacementPage = new Promise<NotificationPage>((resolve) => {
      resolveReplacement = resolve;
    });
    mocks.getRecipeBootstrap
      .mockResolvedValueOnce({
        recipeBox: { recipes: [], box: { completed: true, recipeSlugs: [] } },
        diet: { profile: {}, options: {} },
        unreadNotificationCount: 5,
      })
      .mockImplementationOnce(async () => ({
        recipeBox: { recipes: [], box: { completed: true, recipeSlugs: [] } },
        diet: { profile: {}, options: {} },
        unreadNotificationCount: (await replacementPage).unreadCount,
      }));
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
    expect(
      await screen.findByRole("link", { name: "Notifications, 2 unread" }),
    ).toBeInTheDocument();
  });
});
