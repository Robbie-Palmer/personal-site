import { betterAuth } from "better-auth";
import { admin, lastLoginMethod } from "better-auth/plugins";
import { withCloudflare } from "better-auth-cloudflare";
import type { createDb } from "./db";
import * as schema from "./db/schema";

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
        session: { cookieCache: { enabled: false } },
        advanced: {
          useSecureCookies: isSecure,
          defaultCookieAttributes: {
            httpOnly: true,
            secure: isSecure,
            sameSite: "lax",
          },
        },
      },
    ),
  });
}

export type Auth = ReturnType<typeof createAuth>;
