// Throwaway local-e2e helper: signs in a seeded preview user directly through
// better-auth and prints the session cookie for curl-based API testing.
import { createDb } from "recipe-db";
import { createAuth } from "../src/auth";
import { previewScenarios } from "../src/preview-scenarios";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const databaseURL = requiredEnv("DATABASE_URL");
const { db, client } = createDb(databaseURL);

try {
  const auth = createAuth(db, {
    DEPLOYMENT_ENV: "preview",
    BETTER_AUTH_URL: requiredEnv("BETTER_AUTH_URL"),
    BETTER_AUTH_SECRET: requiredEnv("BETTER_AUTH_SECRET"),
  });
  const response = await auth.api.signInEmail({
    body: {
      email: previewScenarios[0].email,
      password: requiredEnv("PREVIEW_AUTH_PASSWORD"),
    },
    asResponse: true,
  });
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) throw new Error(`No session cookie (status ${response.status})`);
  console.log(setCookie.split(";")[0]);
} finally {
  await client.end({ timeout: 5 });
}
