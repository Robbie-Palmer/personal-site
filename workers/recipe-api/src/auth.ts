import { betterAuth } from "better-auth";
import { admin, lastLoginMethod } from "better-auth/plugins";
import { withCloudflare } from "better-auth-cloudflare";
import { eq } from "drizzle-orm";
import type { createDb } from "./db";
import * as schema from "./db/schema";
import { enforceRateLimit } from "./http/rate-limit";

type Db = ReturnType<typeof createDb>["db"];

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
  db: ReturnType<typeof createDb>["db"],
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
          autoSignIn: false,
        },
        socialProviders,
        account: {
          accountLinking: {
            enabled: true,
            // Both verify email, so a matching-email sign-in can auto-attach
            // to an existing account.
            trustedProviders: ["google", "github"],
            // Let a signed-in user link the other provider even when its email
            // differs from the one already on the account.
            allowDifferentEmails: true,
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
