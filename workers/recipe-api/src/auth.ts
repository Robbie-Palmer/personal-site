import { betterAuth } from "better-auth";
import { admin, lastLoginMethod } from "better-auth/plugins";
import { withCloudflare } from "better-auth-cloudflare";
import { and, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type { Db } from "recipe-db";
import * as schema from "recipe-db/schema";
import { createRecipeAgentAuthPlugin } from "./agent-auth";
import { enforceRateLimit } from "./http/rate-limit";
import { createHouseholdNotification } from "./notifications";
import {
  canonicalEmailIsAvailable,
  syncCanonicalUserEmail,
  syncLinkedAccountEmails,
} from "./user-emails";

type AuthEnv = {
  BETTER_AUTH_URL: string;
  DEPLOYMENT_ENV?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  BETTER_AUTH_SECRET: string;
};

type CreateAuthOptions = {
  allowPreviewSignUp?: boolean;
  autoSignInPreviewSignUp?: boolean;
};

const AGENT_AUTH_JTI_STORAGE_PREFIX = "agent-auth:jti:";
const AGENT_AUTH_JTI_RESERVATION_TTL_SECONDS = 2 * 60;
const AUTH_SECONDARY_STORAGE_DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60;
const AUTH_SECONDARY_STORAGE_MAX_TTL_SECONDS = 90 * 24 * 60 * 60;

function rateLimitStorage(db: Db) {
  const namespaced = (key: string) => `auth:${key}`;
  return {
    consume: async (key: string, rule: { window: number; max: number }) => {
      const result = await enforceRateLimit(db, namespaced(key), {
        max: rule.max,
        windowSeconds: rule.window,
      });
      return {
        allowed: result.allowed,
        retryAfter: result.allowed ? null : result.retryAfter,
      };
    },
    get: async (key: string) => {
      const [row] = await db
        .select({
          count: schema.appRateLimit.count,
          windowStart: schema.appRateLimit.windowStart,
        })
        .from(schema.appRateLimit)
        .where(eq(schema.appRateLimit.key, namespaced(key)))
        .limit(1);
      return row
        ? { key, count: row.count, lastRequest: row.windowStart.getTime() }
        : undefined;
    },
    set: async (
      key: string,
      value: { key: string; count: number; lastRequest: number },
    ) => {
      const windowStart = new Date(value.lastRequest);
      await db
        .insert(schema.appRateLimit)
        .values({ key: namespaced(key), count: value.count, windowStart })
        .onConflictDoUpdate({
          target: schema.appRateLimit.key,
          set: { count: value.count, windowStart },
        });
    },
  };
}

function authSecondaryStorage(db: Db) {
  return {
    get: async (key: string) => {
      if (key.startsWith(AGENT_AUTH_JTI_STORAGE_PREFIX)) {
        const now = new Date();
        const expiresAt = new Date(
          now.getTime() + AGENT_AUTH_JTI_RESERVATION_TTL_SECONDS * 1_000,
        );
        return db.transaction(async (tx) => {
          await tx
            .delete(schema.authSecondaryStorage)
            .where(lte(schema.authSecondaryStorage.expiresAt, now));
          const [reservation] = await tx
            .insert(schema.authSecondaryStorage)
            .values({ key, value: "1", expiresAt })
            .onConflictDoNothing()
            .returning({ key: schema.authSecondaryStorage.key });
          return reservation ? null : "1";
        });
      }
      const [entry] = await db
        .select({
          value: schema.authSecondaryStorage.value,
          expiresAt: schema.authSecondaryStorage.expiresAt,
        })
        .from(schema.authSecondaryStorage)
        .where(eq(schema.authSecondaryStorage.key, key))
        .limit(1);
      if (!entry) return null;
      if (entry.expiresAt && entry.expiresAt.getTime() <= Date.now()) {
        await db
          .delete(schema.authSecondaryStorage)
          .where(eq(schema.authSecondaryStorage.key, key));
        return null;
      }
      return entry.value;
    },
    getAndDelete: async (key: string) => {
      const [entry] = await db
        .delete(schema.authSecondaryStorage)
        .where(
          and(
            eq(schema.authSecondaryStorage.key, key),
            or(
              isNull(schema.authSecondaryStorage.expiresAt),
              gt(schema.authSecondaryStorage.expiresAt, new Date()),
            ),
          ),
        )
        .returning({ value: schema.authSecondaryStorage.value });
      return entry ? entry.value : null;
    },
    increment: async (key: string, ttl: number) => {
      const expiresAt = new Date(Date.now() + ttl * 1_000);
      const [entry] = await db
        .insert(schema.authSecondaryStorage)
        .values({ key, value: "1", expiresAt })
        .onConflictDoUpdate({
          target: schema.authSecondaryStorage.key,
          set: {
            value: sql`${schema.authSecondaryStorage.value}::bigint + 1`,
          },
        })
        .returning({ value: schema.authSecondaryStorage.value });
      return Number(entry?.value ?? 1);
    },
    set: async (key: string, value: string, ttlSeconds?: number) => {
      const boundedTtlSeconds =
        typeof ttlSeconds === "number" &&
        Number.isFinite(ttlSeconds) &&
        ttlSeconds > 0
          ? Math.min(ttlSeconds, AUTH_SECONDARY_STORAGE_MAX_TTL_SECONDS)
          : AUTH_SECONDARY_STORAGE_DEFAULT_TTL_SECONDS;
      const expiresAt = new Date(Date.now() + boundedTtlSeconds * 1_000);
      await db
        .insert(schema.authSecondaryStorage)
        .values({ key, value, expiresAt })
        .onConflictDoUpdate({
          target: schema.authSecondaryStorage.key,
          set: { value, expiresAt },
        });
    },
    delete: async (key: string) => {
      await db
        .delete(schema.authSecondaryStorage)
        .where(eq(schema.authSecondaryStorage.key, key));
    },
  };
}

export function createAuth(
  db: Db,
  env: AuthEnv,
  options: CreateAuthOptions = {},
) {
  const baseURL = new URL(env.BETTER_AUTH_URL).origin;
  const isSecure = baseURL.startsWith("https://");
  const isPreview = env.DEPLOYMENT_ENV === "preview";
  const socialProviders = isPreview
    ? {}
    : {
        google: {
          clientId: env.GOOGLE_CLIENT_ID ?? "",
          clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
        },
        github: {
          clientId: env.GITHUB_CLIENT_ID ?? "",
          clientSecret: env.GITHUB_CLIENT_SECRET ?? "",
        },
      };

  async function handleAccountDeletion(deletedUser: { id: string; name: string }) {
    const [membership] = await db
      .select({
        householdId: schema.member.organizationId,
        role: schema.member.role,
        householdName: schema.organization.name,
      })
      .from(schema.member)
      .innerJoin(
        schema.organization,
        eq(schema.member.organizationId, schema.organization.id),
      )
      .where(eq(schema.member.userId, deletedUser.id))
      .limit(1);
    if (!membership) return;

    if (membership.role !== "owner") {
      const [owner] = await db
        .select({ userId: schema.member.userId })
        .from(schema.member)
        .where(
          and(
            eq(schema.member.organizationId, membership.householdId),
            eq(schema.member.role, "owner"),
          ),
        )
        .limit(1);
      if (owner) {
        await db.transaction(async (tx) => {
          await createHouseholdNotification(tx, {
            recipientUserIds: [owner.userId],
            kind: "household_member_left",
            actor: deletedUser,
            household: {
              id: membership.householdId,
              name: membership.householdName,
            },
          });
        });
      }
      return;
    }

    await db.transaction(async (tx) => {
      const [lockedHousehold] = await tx
        .select({ id: schema.organization.id, name: schema.organization.name })
        .from(schema.organization)
        .where(eq(schema.organization.id, membership.householdId))
        .for("update")
        .limit(1);
      if (!lockedHousehold) return;

      const otherMembers = await tx
        .select({ userId: schema.member.userId })
        .from(schema.member)
        .where(eq(schema.member.organizationId, membership.householdId));
      const otherUserIds = otherMembers
        .map(({ userId }) => userId)
        .filter((userId) => userId !== deletedUser.id);
      await createHouseholdNotification(tx, {
        recipientUserIds: otherUserIds,
        kind: "household_deleted",
        actor: deletedUser,
        household: {
          id: membership.householdId,
          name: lockedHousehold.name,
        },
      });
      if (otherUserIds.length > 0) {
        await tx
          .update(schema.recipe)
          .set({ visibility: "private" })
          .where(
            and(
              eq(schema.recipe.visibility, "household"),
              inArray(schema.recipe.userId, otherUserIds),
            ),
          );
      }
      await tx
        .delete(schema.organization)
        .where(eq(schema.organization.id, membership.householdId));
    });
  }

  return betterAuth({
    baseURL,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    ...withCloudflare(
      {
        postgres: { db, options: { schema } },
        autoDetectIpAddress: false,
        geolocationTracking: false,
      },
      {
        plugins: [
          admin(),
          lastLoginMethod(),
          createRecipeAgentAuthPlugin(db),
        ],
        emailAndPassword: {
          enabled: isPreview,
          disableSignUp: !options.allowPreviewSignUp,
          autoSignIn: options.autoSignInPreviewSignUp ?? false,
        },
        socialProviders,
        account: {
          accountLinking: {
            enabled: true,
            trustedProviders: ["google", "github"],
            allowDifferentEmails: true,
          },
        },
        user: {
          deleteUser: {
            enabled: true,
          },
        },
        databaseHooks: {
          user: {
            create: {
              before: async (user) =>
                canonicalEmailIsAvailable(db, user.email),
              after: async (user) => syncCanonicalUserEmail(db, user),
            },
            update: {
              after: async (user) => syncCanonicalUserEmail(db, user),
            },
            delete: {
              before: async (user) => handleAccountDeletion(user),
            },
          },
          account: {
            create: {
              after: async (account) => syncLinkedAccountEmails(db, account),
            },
            update: {
              after: async (account) => syncLinkedAccountEmails(db, account),
            },
          },
        },
        session: { cookieCache: { enabled: false } },
        rateLimit: {
          enabled: true,
          window: 60,
          max: 100,
          customRules: {
            "/sign-in/social": { window: 60, max: 20 },
          },
          customStorage: rateLimitStorage(db),
        },
        advanced: {
          useSecureCookies: isSecure,
          defaultCookieAttributes: {
            httpOnly: true,
            secure: isSecure,
            sameSite: "lax",
          },
          ipAddress: {
            ipAddressHeaders: ["cf-connecting-ip"],
          },
        },
      },
    ),
    // withCloudflare replaces secondaryStorage with its KV adapter or
    // undefined. Apply the PostgreSQL adapter after its returned options so
    // Agent Auth replay protection survives across Worker requests.
    secondaryStorage: authSecondaryStorage(db),
  });
}

export type Auth = ReturnType<typeof createAuth>;
