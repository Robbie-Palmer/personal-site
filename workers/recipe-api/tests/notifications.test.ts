import { describe, expect, it, vi } from "vitest";
import * as schema from "recipe-db/schema";
import {
  createAgentApprovalNotification,
  createHouseholdNotification,
  createRecipeRecommendationNotification,
  decryptAgentApprovalCode,
  encryptAgentApprovalCode,
  markInvitationNotificationRead,
  notifyAgentRegistrationApproval,
} from "../src/notifications";

function agentRegistrationResponse(): Response {
  return Response.json({
    agent_id: "agent-1",
    name: "Meal planner",
    approval: {
      method: "device_authorization",
      device_code: "approval-1",
      user_code: "ABCD-1234",
    },
  });
}

describe("notification persistence", () => {
  it("encrypts approval codes for one-click notification links", async () => {
    const encrypted = await encryptAgentApprovalCode(
      "ABCD-1234",
      "test-secret-at-least-32-characters-long",
    );

    expect(encrypted).not.toContain("ABCD-1234");
    await expect(
      decryptAgentApprovalCode(
        encrypted,
        "test-secret-at-least-32-characters-long",
      ),
    ).resolves.toBe("ABCD-1234");
    await expect(
      decryptAgentApprovalCode(
        encrypted,
        "different-test-secret-at-least-32-chars",
      ),
    ).rejects.toThrow();
  });

  it("stores an agent approval notification without the device code", async () => {
    const inserts: Array<{ table: unknown; values: unknown }> = [];
    const db = {
      insert: (table: unknown) => ({
        values: (values: unknown) => {
          inserts.push({ table, values });
          return Promise.resolve();
        },
      }),
    };
    const expiresAt = new Date("2026-08-22T14:05:00.000Z");

    await createAgentApprovalNotification(db as never, {
      recipientUserId: "user-1",
      approval: { id: "approval-1", expiresAt },
      agent: { id: "agent-1", name: "Meal planner" },
      capabilities: ["recipes.search", "recipes.read"],
      approvalCodeCiphertext: "v1.encrypted.code",
    });

    expect(inserts.map(({ table }) => table)).toEqual([
      schema.notificationEvent,
      schema.notificationAgentApprovalEvent,
      schema.notificationDelivery,
    ]);
    expect(inserts[0]?.values).toMatchObject({
      kind: "agent_approval_requested",
    });
    expect(inserts[1]?.values).toEqual(
      expect.objectContaining({
        approvalRequestId: "approval-1",
        agentIdSnapshot: "agent-1",
        agentNameSnapshot: "Meal planner",
        capabilitiesSnapshot: "recipes.search recipes.read",
        expiresAtSnapshot: expiresAt,
        approvalCodeCiphertext: "v1.encrypted.code",
      }),
    );
    expect(inserts[1]?.values).not.toHaveProperty("userCode");
    expect(inserts[2]?.values).toMatchObject({ recipientUserId: "user-1" });
  });

  it("creates a notification from a successful Agent Auth registration", async () => {
    const inserts: Array<{ table: unknown; values: unknown }> = [];
    const transactionDb = {
      insert: (table: unknown) => ({
        values: (values: unknown) => {
          inserts.push({ table, values });
          return Promise.resolve();
        },
      }),
    };
    const expiresAt = new Date("2026-08-22T14:05:00.000Z");
    const query = {
      from: () => query,
      where: () => query,
      limit: () =>
        Promise.resolve([
          {
            id: "approval-1",
            userId: "user-1",
            capabilities: "recipes.search recipes.read",
            expiresAt,
          },
        ]),
    };
    const db = {
      select: () => query,
      transaction: (callback: (tx: typeof transactionDb) => Promise<void>) =>
        callback(transactionDb),
    };

    await notifyAgentRegistrationApproval(
      db as never,
      agentRegistrationResponse(),
      "test-secret-at-least-32-characters-long",
    );

    expect(inserts.map(({ table }) => table)).toEqual([
      schema.notificationEvent,
      schema.notificationAgentApprovalEvent,
      schema.notificationDelivery,
    ]);
    const subtype = inserts[1]?.values as {
      approvalCodeCiphertext: string;
      capabilitiesSnapshot: string;
    };
    expect(subtype.capabilitiesSnapshot).toBe("recipes.search recipes.read");
    expect(subtype.approvalCodeCiphertext).not.toContain("ABCD-1234");
    await expect(
      decryptAgentApprovalCode(
        subtype.approvalCodeCiphertext,
        "test-secret-at-least-32-characters-long",
      ),
    ).resolves.toBe("ABCD-1234");
  });

  it("ignores unsuccessful, malformed, and unowned registrations", async () => {
    const transaction = vi.fn();
    const select = vi.fn(() => {
      const query = {
        from: () => query,
        where: () => query,
        limit: () =>
          Promise.resolve([
            {
              id: "approval-1",
              userId: null,
              capabilities: null,
              expiresAt: new Date("2026-08-22T14:05:00.000Z"),
            },
          ]),
      };
      return query;
    });
    const db = { select, transaction };

    await notifyAgentRegistrationApproval(
      db as never,
      new Response(null, { status: 400 }),
      "test-secret-at-least-32-characters-long",
    );
    await notifyAgentRegistrationApproval(
      db as never,
      new Response("not-json", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
      "test-secret-at-least-32-characters-long",
    );
    await notifyAgentRegistrationApproval(
      db as never,
      Response.json({ agent_id: "agent-1" }),
      "test-secret-at-least-32-characters-long",
    );
    await notifyAgentRegistrationApproval(
      db as never,
      agentRegistrationResponse(),
      "test-secret-at-least-32-characters-long",
    );

    expect(select).toHaveBeenCalledOnce();
    expect(transaction).not.toHaveBeenCalled();
  });

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
