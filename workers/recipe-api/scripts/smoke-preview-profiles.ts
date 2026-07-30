// Authenticated preview smoke test that runs inside the protected GitHub
// environment. It creates a Better Auth session directly against the isolated
// preview database, then exercises the deployed Worker without bypassing
// Cloudflare Access on the Pages UI.
import { createDb } from "recipe-db";
import { createAuth } from "../src/auth";
import { previewScenarios } from "../src/preview-scenarios";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

type RecipeBoxProfile = {
  completed: boolean;
  recipeSlugs: string[];
  staticRecipeSlugs: string[];
};

type DietProfile = {
  presetDietKeys: string[];
  excludedIngredientSlugs: string[];
  excludedGroupKeys: string[];
  recipeMatchMode: "hide" | "warn";
};

const databaseURL = requiredEnv("DATABASE_URL");
const siteURL = requiredEnv("BETTER_AUTH_URL");
const apiURL = requiredEnv("PREVIEW_API_URL").replace(/\/$/, "");

async function expectJson<T>(path: string, cookie: string): Promise<T> {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const response = await fetch(`${apiURL}${path}`, {
      headers: { cookie },
    });
    if (response.ok) return response.json() as Promise<T>;
    // Wrangler can report success before every request reaches the new Worker
    // version, and the previous version points at the just-deleted Neon branch.
    if (response.status === 503 && attempt < 30) {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      continue;
    }
    throw new Error(
      `GET ${path} returned ${response.status}: ${await response.text()}`,
    );
  }
  throw new Error(`GET ${path} did not become ready`);
}

async function createSessionCookie(): Promise<string> {
  const { db, client } = createDb(databaseURL);
  try {
    const auth = createAuth(db, {
      DEPLOYMENT_ENV: "preview",
      BETTER_AUTH_URL: siteURL,
      BETTER_AUTH_SECRET: requiredEnv("BETTER_AUTH_SECRET"),
    });
    const signIn = await auth.api.signInEmail({
      body: {
        email: previewScenarios[0].email,
        password: requiredEnv("PREVIEW_AUTH_PASSWORD"),
      },
      asResponse: true,
    });
    const setCookie = signIn.headers.get("set-cookie");
    if (!setCookie) {
      throw new Error(
        `Preview sign-in returned no session cookie (${signIn.status})`,
      );
    }
    const cookie = setCookie.match(
      /(?:__Secure-)?better-auth[.-]session_token=[^;,\s]+/,
    )?.[0];
    if (!cookie) {
      throw new Error("Preview sign-in returned no session-token cookie");
    }
    return cookie;
  } finally {
    await client.end({ timeout: 5 });
  }
}

function assertStringArray(
  value: unknown,
  name: string,
): asserts value is string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new TypeError(`${name} must be an array of strings`);
  }
}

const cookie = await createSessionCookie();
const recipeBox = await expectJson<RecipeBoxProfile>(
  "/api/profile/recipe-box",
  cookie,
);
if (typeof recipeBox.completed !== "boolean") {
  throw new TypeError("Recipe-box completion state must be boolean");
}
assertStringArray(recipeBox.recipeSlugs, "recipeSlugs");
assertStringArray(recipeBox.staticRecipeSlugs, "staticRecipeSlugs");

const dietProfile = await expectJson<DietProfile>("/api/profile/diet", cookie);
assertStringArray(dietProfile.presetDietKeys, "presetDietKeys");
assertStringArray(
  dietProfile.excludedIngredientSlugs,
  "excludedIngredientSlugs",
);
assertStringArray(dietProfile.excludedGroupKeys, "excludedGroupKeys");
if (
  dietProfile.recipeMatchMode !== "hide" &&
  dietProfile.recipeMatchMode !== "warn"
) {
  throw new TypeError("recipeMatchMode must be hide or warn");
}

console.log("Authenticated preview profile smoke test passed.");
