export type HouseholdNotificationType =
  | "household_invited"
  | "household_removed"
  | "household_deleted"
  | "household_invite_accepted"
  | "household_invite_declined"
  | "household_member_left";

export type HouseholdNotification = {
  id: string;
  type: HouseholdNotificationType;
  actorName: string | null;
  householdName: string;
  householdId: string | null;
  invitationId: string | null;
  readAt: string | null;
  createdAt: string;
};

async function checked(response: Response) {
  if (response.ok) return response;
  const body = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  throw new Error(body?.error ?? "Notification request failed.");
}

export async function getNotifications(signal?: AbortSignal) {
  const response = await checked(
    await fetch("/api/notifications", { credentials: "same-origin", signal }),
  );
  return response.json() as Promise<HouseholdNotification[]>;
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

export async function markAllNotificationsRead() {
  await checked(
    await fetch("/api/notifications/read-all", {
      method: "POST",
      credentials: "same-origin",
    }),
  );
}

export async function respondToHouseholdInvitation(
  invitationId: string,
  response: "accept" | "decline",
) {
  await checked(
    await fetch(`/api/households/invitations/${invitationId}/${response}`, {
      method: "POST",
      credentials: "same-origin",
    }),
  );
}
