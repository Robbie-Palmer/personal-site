export type HouseholdNotificationKind =
  | "household_invited"
  | "household_removed"
  | "household_deleted"
  | "household_invite_accepted"
  | "household_invite_declined"
  | "household_member_left";

type NotificationBase = {
  id: string;
  eventId: string;
  kind: string;
  actor: { id: string | null; name: string | null } | null;
  actions: string[];
  readAt: string | null;
  occurredAt: string;
};

export type HouseholdNotification = NotificationBase & {
  kind: HouseholdNotificationKind;
  detail: {
    type: "household";
    household: { id: string | null; name: string };
    invitationStatus:
      | "pending"
      | "accepted"
      | "declined"
      | "expired"
      | "unavailable"
      | null;
  };
};

export type UnsupportedNotification = NotificationBase & {
  detail: null;
};

export type InAppNotification = HouseholdNotification | UnsupportedNotification;

export type NotificationPage = {
  items: InAppNotification[];
  nextOffset: number | null;
  unreadCount: number;
};

async function checked(response: Response) {
  if (response.ok) return response;
  const body = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  throw new Error(body?.error ?? "Notification request failed.");
}

export async function getNotificationPage(
  offset = 0,
  signal?: AbortSignal,
): Promise<NotificationPage> {
  const response = await checked(
    await fetch(`/api/notifications?offset=${offset}`, {
      credentials: "same-origin",
      signal,
    }),
  );
  return response.json() as Promise<NotificationPage>;
}

export async function getNotifications(signal?: AbortSignal) {
  return (await getNotificationPage(0, signal)).items;
}

export async function updateNotification(
  id: string,
  update: { read?: boolean; dismissed?: boolean },
) {
  await checked(
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(update),
    }),
  );
}

export async function performNotificationAction(
  id: string,
  actionKey: string,
): Promise<InAppNotification> {
  const response = await checked(
    await fetch(`/api/notifications/${id}/actions/${actionKey}`, {
      method: "POST",
      credentials: "same-origin",
    }),
  );
  const body = (await response.json()) as { item: InAppNotification };
  return body.item;
}

export async function markAllNotificationsRead() {
  await checked(
    await fetch("/api/notifications/read-all", {
      method: "POST",
      credentials: "same-origin",
    }),
  );
}

export async function clearAllNotifications() {
  await checked(
    await fetch("/api/notifications/clear-all", {
      method: "POST",
      credentials: "same-origin",
    }),
  );
}
