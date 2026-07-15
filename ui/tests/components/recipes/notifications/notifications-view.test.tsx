import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HouseholdNotification } from "@/lib/api/notifications";

const mocks = vi.hoisted(() => ({
  useSession: vi.fn(),
  getNotificationPage: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  clearAllNotifications: vi.fn(),
  performNotificationAction: vi.fn(),
  updateNotification: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: mocks.useSession },
}));

vi.mock("@/lib/api/notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/notifications")>()),
  getNotificationPage: mocks.getNotificationPage,
  markAllNotificationsRead: mocks.markAllNotificationsRead,
  clearAllNotifications: mocks.clearAllNotifications,
  performNotificationAction: mocks.performNotificationAction,
  updateNotification: mocks.updateNotification,
}));

import { NotificationsView } from "@/components/recipes/notifications/notifications-view";

const invitation = {
  id: "notification-1",
  eventId: "event-1",
  kind: "household_invited",
  actor: { id: "user-alex", name: "Alex" },
  actions: ["accept", "decline"],
  detail: {
    type: "household",
    household: { id: "household-1", name: "Park Road" },
    invitationStatus: "pending",
  },
  readAt: null,
  occurredAt: "2026-07-14T12:00:00.000Z",
} satisfies HouseholdNotification;

const acceptedInvitation = {
  ...invitation,
  actions: [],
  detail: { ...invitation.detail, invitationStatus: "accepted" },
  readAt: "2026-07-14T12:01:00.000Z",
} satisfies HouseholdNotification;

describe("NotificationsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useSession.mockReturnValue({
      data: { user: { id: "user-1" } },
      isPending: false,
    });
    mocks.getNotificationPage.mockResolvedValue({
      items: [invitation],
      nextOffset: null,
    });
    mocks.markAllNotificationsRead.mockResolvedValue(undefined);
    mocks.clearAllNotifications.mockResolvedValue(undefined);
    mocks.performNotificationAction.mockResolvedValue(acceptedInvitation);
    mocks.updateNotification.mockResolvedValue(undefined);
  });

  it("keeps an accepted invitation as a read, resolved notification", async () => {
    const user = userEvent.setup();
    render(<NotificationsView />);

    await user.click(await screen.findByRole("button", { name: "Accept" }));

    expect(
      await screen.findByText(
        "You accepted Alex's invitation to join Park Road.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("accepted", { exact: true })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept" })).toBeNull();
    expect(screen.getByText(/0 unread/)).toBeInTheDocument();
    expect(mocks.performNotificationAction).toHaveBeenCalledWith(
      "notification-1",
      "accept",
    );
    expect(mocks.updateNotification).not.toHaveBeenCalled();
  });

  it("prevents dismissing an invitation while its response is pending", async () => {
    let resolveResponse:
      | ((notification: HouseholdNotification) => void)
      | undefined;
    mocks.performNotificationAction.mockReturnValue(
      new Promise<HouseholdNotification>((resolve) => {
        resolveResponse = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<NotificationsView />);

    await user.click(await screen.findByRole("button", { name: "Accept" }));

    expect(
      screen.getByRole("button", { name: "Dismiss notification" }),
    ).toBeDisabled();
    resolveResponse?.(acceptedInvitation);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Dismiss notification" }),
      ).not.toBeDisabled(),
    );
  });

  it("marks all as read without removing notifications", async () => {
    const user = userEvent.setup();
    render(<NotificationsView />);

    await user.click(
      await screen.findByRole("button", { name: "Mark all read" }),
    );

    await waitFor(() =>
      expect(mocks.markAllNotificationsRead).toHaveBeenCalledOnce(),
    );
    expect(
      screen.getByText(/invited you to join Park Road/),
    ).toBeInTheDocument();
    expect(screen.getByText(/0 unread/)).toBeInTheDocument();
  });

  it("clears every notification from the archive", async () => {
    const user = userEvent.setup();
    render(<NotificationsView />);

    await user.click(await screen.findByRole("button", { name: "Clear all" }));

    await waitFor(() =>
      expect(mocks.clearAllNotifications).toHaveBeenCalledOnce(),
    );
    expect(screen.getByText("You're all caught up.")).toBeInTheDocument();
    expect(screen.queryByText(/invited you to join Park Road/)).toBeNull();
  });

  it("loads subsequent archive pages", async () => {
    const older = {
      ...invitation,
      id: "notification-2",
      eventId: "event-2",
      kind: "household_member_left",
      actor: { id: "user-sam", name: "Sam" },
      actions: [],
      detail: { ...invitation.detail, invitationStatus: null },
      readAt: "2026-07-14T13:00:00.000Z",
      occurredAt: "2026-06-01T12:00:00.000Z",
    } satisfies HouseholdNotification;
    mocks.getNotificationPage
      .mockResolvedValueOnce({ items: [invitation], nextOffset: 100 })
      .mockResolvedValueOnce({ items: [older], nextOffset: null });
    const user = userEvent.setup();
    render(<NotificationsView />);

    await user.click(await screen.findByRole("button", { name: "Load more" }));

    expect(await screen.findByText("Sam left Park Road.")).toBeInTheDocument();
    expect(mocks.getNotificationPage).toHaveBeenLastCalledWith(100);
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });
});
