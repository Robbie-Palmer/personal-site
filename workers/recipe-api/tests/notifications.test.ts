import { describe, expect, it, vi } from "vitest";
import * as schema from "recipe-db/schema";
import {
  createHouseholdNotification,
  createRecipeRecommendationNotification,
  markInvitationNotificationRead,
} from "../src/notifications";

describe("notification persistence", () => {
  it("stores generic event and delivery rows separately from household subtypes", async () => {
    const inserts: Array<{ table: unknown; values: unknown }> = [];
    const db = {
      insert: (table: unknown) => ({
        values: (values: unknown) => {
          inserts.push({ table, values });
          return Promise.resolve();
        },
      }),
    };

    await createHouseholdNotification(db as never, {
      recipientUserIds: ["recipient-1", "recipient-2"],
      kind: "household_invited",
      household: { id: "household-1", name: "Park Road" },
      actor: { id: "owner-1", name: "Alex" },
      invitationId: "invitation-1",
    });

    expect(inserts.map(({ table }) => table)).toEqual([
      schema.notificationEvent,
      schema.notificationHouseholdEvent,
      schema.notificationHouseholdInvitationEvent,
      schema.notificationDelivery,
    ]);
    expect(inserts[0]?.values).toMatchObject({
      kind: "household_invited",
      actorUserId: "owner-1",
      actorNameSnapshot: "Alex",
    });
    expect(inserts[1]?.values).toMatchObject({
      householdId: "household-1",
      householdNameSnapshot: "Park Road",
    });
    expect(inserts[2]?.values).toMatchObject({ invitationId: "invitation-1" });
    expect(inserts[3]?.values).toEqual([
      expect.objectContaining({ recipientUserId: "recipient-1" }),
      expect.objectContaining({ recipientUserId: "recipient-2" }),
    ]);
  });

  it("does not create an event when there are no recipients", async () => {
    const insert = vi.fn();
    await createHouseholdNotification({ insert } as never, {
      recipientUserIds: [],
      kind: "household_deleted",
      household: { id: "household-1", name: "Park Road" },
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("stores a recipe recommendation with stable recipe snapshots", async () => {
    const inserts: Array<{ table: unknown; values: unknown }> = [];
    const db = {
      insert: (table: unknown) => ({
        values: (values: unknown) => {
          inserts.push({ table, values });
          return Promise.resolve();
        },
      }),
    };

    await createRecipeRecommendationNotification(db as never, {
      recipientUserId: "recipient-1",
      recipe: {
        id: "706db8bc-cabe-4e26-a1bf-d67a99d2c071",
        slug: "weekday-stew",
        title: "Weekday Stew",
      },
      actor: { id: "cook-1", name: "Alex" },
    });

    expect(inserts.map(({ table }) => table)).toEqual([
      schema.notificationEvent,
      schema.notificationRecipeRecommendationEvent,
      schema.notificationDelivery,
    ]);
    expect(inserts[0]?.values).toMatchObject({
      kind: "recipe_recommended",
      actorUserId: "cook-1",
      actorNameSnapshot: "Alex",
    });
    expect(inserts[1]?.values).toMatchObject({
      recipeSlugSnapshot: "weekday-stew",
      recipeTitleSnapshot: "Weekday Stew",
    });
    expect(inserts[2]?.values).toMatchObject({
      recipientUserId: "recipient-1",
    });
  });

  it("marks deliveries for an invitation event as read", async () => {
    const whereUpdate = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn(() => ({ where: whereUpdate }));
    const update = vi.fn(() => ({ set }));
    const db = {
      select: () => ({
        from: () => ({
          where: () => Promise.resolve([{ eventId: "event-1" }]),
        }),
      }),
      update,
    };
    const readAt = new Date("2026-07-15T12:00:00.000Z");

    await markInvitationNotificationRead(
      db as never,
      "recipient-1",
      "invitation-1",
      readAt,
    );

    expect(update).toHaveBeenCalledWith(schema.notificationDelivery);
    expect(set).toHaveBeenCalledWith({ readAt });
    expect(whereUpdate).toHaveBeenCalledOnce();
  });
});
