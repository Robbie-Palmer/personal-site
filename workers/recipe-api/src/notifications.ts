import { and, eq, inArray } from "drizzle-orm";
import type { createDb } from "recipe-db";
import * as schema from "recipe-db/schema";

type Db = ReturnType<typeof createDb>["db"];

export type HouseholdNotificationKind =
  | "household_invited"
  | "household_removed"
  | "household_deleted"
  | "household_invite_accepted"
  | "household_invite_declined"
  | "household_member_left";

export async function createHouseholdNotification(
  db: Pick<Db, "insert">,
  values: {
    recipientUserIds: string[];
    kind: HouseholdNotificationKind;
    household: { id: string; name: string };
    actor?: { id: string; name: string };
    invitationId?: string;
  },
) {
  if (values.recipientUserIds.length === 0) return;

  const eventId = crypto.randomUUID();
  await db.insert(schema.notificationEvent).values({
    id: eventId,
    kind: values.kind,
    actorUserId: values.actor?.id,
    actorNameSnapshot: values.actor?.name,
  });
  await db.insert(schema.notificationHouseholdEvent).values({
    eventId,
    householdId: values.household.id,
    householdNameSnapshot: values.household.name,
  });
  if (values.invitationId) {
    await db.insert(schema.notificationHouseholdInvitationEvent).values({
      eventId,
      invitationId: values.invitationId,
    });
  }
  await db.insert(schema.notificationDelivery).values(
    values.recipientUserIds.map((recipientUserId) => ({
      id: crypto.randomUUID(),
      eventId,
      recipientUserId,
    })),
  );
}

export async function markInvitationNotificationRead(
  db: Pick<Db, "select" | "update">,
  recipientUserId: string,
  invitationId: string,
  readAt: Date,
) {
  const invitationEvents = await db
    .select({ eventId: schema.notificationHouseholdInvitationEvent.eventId })
    .from(schema.notificationHouseholdInvitationEvent)
    .where(
      eq(
        schema.notificationHouseholdInvitationEvent.invitationId,
        invitationId,
      ),
    );
  if (invitationEvents.length === 0) return;

  await db
    .update(schema.notificationDelivery)
    .set({ readAt })
    .where(
      and(
        eq(schema.notificationDelivery.recipientUserId, recipientUserId),
        inArray(
          schema.notificationDelivery.eventId,
          invitationEvents.map(({ eventId }) => eventId),
        ),
      ),
    );
}
