import { betterAuth } from "better-auth";
import { admin, lastLoginMethod } from "better-auth/plugins";
import { withCloudflare } from "better-auth-cloudflare";
import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "recipe-db";
import * as schema from "recipe-db/schema";
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
        plugins: [admin(), lastLoginMethod()],
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
  });
}

export type Auth = ReturnType<typeof createAuth>;
