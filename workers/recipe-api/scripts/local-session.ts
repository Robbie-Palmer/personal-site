// Throwaway local-e2e helper: signs in a seeded preview user directly through
// better-auth and prints the session cookie for curl-based API testing.
import { requiredEnv } from "node-base/env";
import { previewScenarios } from "../src/preview-scenarios";
import { createPreviewSessionCookie } from "./preview-session";

const cookie = await createPreviewSessionCookie(
  {
    DATABASE_URL: requiredEnv("DATABASE_URL"),
    BETTER_AUTH_URL: requiredEnv("BETTER_AUTH_URL"),
    BETTER_AUTH_SECRET: requiredEnv("BETTER_AUTH_SECRET"),
    PREVIEW_AUTH_PASSWORD: requiredEnv("PREVIEW_AUTH_PASSWORD"),
  },
  previewScenarios[0].email,
);
console.log(cookie);
