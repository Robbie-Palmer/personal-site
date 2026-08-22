import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "recipe-db";
import * as schema from "recipe-db/schema";

const AGENT_APPROVAL_CODE_CIPHER_VERSION = "v1";
const AGENT_APPROVAL_CODE_KEY_CONTEXT = new TextEncoder().encode(
  "recipe-agent-approval-notification",
);

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function agentApprovalCodeKey(secret: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    "HKDF",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: AGENT_APPROVAL_CODE_KEY_CONTEXT,
      info: AGENT_APPROVAL_CODE_KEY_CONTEXT,
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptAgentApprovalCode(
  code: string,
  secret: string,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await agentApprovalCodeKey(secret),
    new TextEncoder().encode(code),
  );
  return [
    AGENT_APPROVAL_CODE_CIPHER_VERSION,
    encodeBase64Url(iv),
    encodeBase64Url(new Uint8Array(ciphertext)),
  ].join(".");
}

export async function decryptAgentApprovalCode(
  value: string,
  secret: string,
): Promise<string> {
  const [version, encodedIv, encodedCiphertext] = value.split(".");
  if (
    version !== AGENT_APPROVAL_CODE_CIPHER_VERSION ||
    !encodedIv ||
    !encodedCiphertext
  ) {
    throw new Error("Unsupported agent approval code ciphertext");
  }
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decodeBase64Url(encodedIv) },
    await agentApprovalCodeKey(secret),
    decodeBase64Url(encodedCiphertext),
  );
  return new TextDecoder().decode(plaintext);
}

export type HouseholdNotificationKind =
  | "household_invited"
  | "household_removed"
  | "household_deleted"
  | "household_invite_accepted"
  | "household_invite_declined"
  | "household_member_left";

export async function createAgentApprovalNotification(
  db: Pick<Db, "insert">,
  values: {
    recipientUserId: string;
    approval: { id: string; expiresAt: Date };
    agent: { id: string; name: string };
    capabilities: string[];
    approvalCodeCiphertext: string;
  },
) {
  const eventId = crypto.randomUUID();
  await db.insert(schema.notificationEvent).values({
    id: eventId,
    kind: "agent_approval_requested",
  });
  await db.insert(schema.notificationAgentApprovalEvent).values({
    eventId,
    approvalRequestId: values.approval.id,
    agentIdSnapshot: values.agent.id,
    agentNameSnapshot: values.agent.name,
    capabilitiesSnapshot: values.capabilities.join(" "),
    expiresAtSnapshot: values.approval.expiresAt,
    approvalCodeCiphertext: values.approvalCodeCiphertext,
  });
  await db.insert(schema.notificationDelivery).values({
    id: crypto.randomUUID(),
    eventId,
    recipientUserId: values.recipientUserId,
  });
}

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

export async function createRecipeRecommendationNotification(
  db: Pick<Db, "insert">,
  values: {
    recipientUserId: string;
    recipe: { id: string; slug: string; title: string };
    actor: { id: string; name: string };
  },
) {
  const eventId = crypto.randomUUID();
  await db.insert(schema.notificationEvent).values({
    id: eventId,
    kind: "recipe_recommended",
    actorUserId: values.actor.id,
    actorNameSnapshot: values.actor.name,
  });
  await db.insert(schema.notificationRecipeRecommendationEvent).values({
    eventId,
    recipeId: values.recipe.id,
    recipeSlugSnapshot: values.recipe.slug,
    recipeTitleSnapshot: values.recipe.title,
  });
  await db.insert(schema.notificationDelivery).values({
    id: crypto.randomUUID(),
    eventId,
    recipientUserId: values.recipientUserId,
  });
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
