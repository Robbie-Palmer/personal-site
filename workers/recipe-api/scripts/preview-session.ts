import { createDb } from "recipe-db";
import { createAuth } from "../src/auth";
import { betterAuthSessionCookie } from "../src/better-auth-session-cookie";

export type PreviewSessionEnvironment = {
  DATABASE_URL: string;
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  PREVIEW_AUTH_PASSWORD: string;
};

export async function createPreviewSessionCookie(
  environment: PreviewSessionEnvironment,
  email: string,
): Promise<string> {
  const { db, client } = createDb(environment.DATABASE_URL);
  try {
    const auth = createAuth(db, {
      DEPLOYMENT_ENV: "preview",
      BETTER_AUTH_URL: environment.BETTER_AUTH_URL,
      BETTER_AUTH_SECRET: environment.BETTER_AUTH_SECRET,
    });
    const response = await auth.api.signInEmail({
      body: { email, password: environment.PREVIEW_AUTH_PASSWORD },
      asResponse: true,
    });
    return await betterAuthSessionCookie(response);
  } finally {
    await client.end({ timeout: 5 });
  }
}
