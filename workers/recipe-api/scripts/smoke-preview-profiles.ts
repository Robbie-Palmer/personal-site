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

type HouseholdSummary = {
  id: string;
  name: string;
  membership: { id: string; role: string };
};

type HouseholdMember = {
  id: string;
  userId: string;
  role: string;
};

const databaseURL = requiredEnv("DATABASE_URL");
const siteURL = requiredEnv("BETTER_AUTH_URL");
const apiURL = requiredEnv("PREVIEW_API_URL").replace(/\/$/, "");
const READY_TIMEOUT_MS = 120_000;
const REQUEST_TIMEOUT_MS = 15_000;
const RETRY_DELAY_MS = 2_000;

async function fetchWhenReady(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${apiURL}${path}`, {
        ...init,
        signal: AbortSignal.timeout(
          Math.min(REQUEST_TIMEOUT_MS, Math.max(1, deadline - Date.now())),
        ),
      });
      // Wrangler can report success before every request reaches the new Worker
      // version. The previous version can lack a new route (404) or point at the
      // just-deleted Neon branch (5xx).
      if (response.status !== 404 && response.status < 500) return response;
      lastError = new Error(`GET ${path} returned ${response.status}`);
      await response.body?.cancel();
    } catch (error) {
      lastError = error;
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(RETRY_DELAY_MS, remaining)),
    );
  }
  throw new Error(`GET ${path} did not become ready within 120 seconds`, {
    cause: lastError,
  });
}

async function expectJson<T>(path: string, cookie: string): Promise<T> {
  const response = await fetchWhenReady(path, { headers: { cookie } });
  if (response.ok) return response.json() as Promise<T>;
  throw new Error(
    `GET ${path} returned ${response.status}: ${await response.text()}`,
  );
}

async function expectAuthenticationRequired(path: string): Promise<void> {
  const response = await fetchWhenReady(path);
  if (response.status !== 401) {
    throw new Error(
      `Unauthenticated GET ${path} returned ${response.status}, expected 401: ${await response.text()}`,
    );
  }
}

async function createSessionCookie(
  email: string = previewScenarios[0].email,
): Promise<string> {
  const { db, client } = createDb(databaseURL);
  try {
    const auth = createAuth(db, {
      DEPLOYMENT_ENV: "preview",
      BETTER_AUTH_URL: siteURL,
      BETTER_AUTH_SECRET: requiredEnv("BETTER_AUTH_SECRET"),
    });
    const signIn = await auth.api.signInEmail({
      body: {
        email,
        password: requiredEnv("PREVIEW_AUTH_PASSWORD"),
      },
      asResponse: true,
    });
    const setCookie = signIn.headers.get("set-cookie");
    await signIn.body?.cancel();
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

await expectAuthenticationRequired("/api/profile/recipe-box");

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
if (
  recipeBox.completed ||
  recipeBox.recipeSlugs.length > 0 ||
  recipeBox.staticRecipeSlugs.length > 0
) {
  throw new Error("Empty-account recipe-box fixture did not match");
}

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
if (
  dietProfile.presetDietKeys.length > 0 ||
  dietProfile.excludedIngredientSlugs.length > 0 ||
  dietProfile.excludedGroupKeys.length > 0 ||
  dietProfile.recipeMatchMode !== "hide"
) {
  throw new Error("Empty-account diet fixture did not match");
}

// Household owner scenario. This exercises the household routes, which validate
// `householdId` (and `memberId`) as UUIDs. A non-UUID seeded organization/member
// ID passes the seed insert (the columns are `text`) but 400s here, so this is
// the coverage that catches an "Invalid household ID" regression.
const ownerCookie = await createSessionCookie("household-owner@preview.invalid");
const households = await expectJson<HouseholdSummary[]>(
  "/households",
  ownerCookie,
);
const household = households[0];
if (households.length !== 1 || !household) {
  throw new Error(
    `Household owner should belong to exactly one household, saw ${households.length}`,
  );
}
if (!household.id || household.membership.role !== "owner") {
  throw new Error("Household owner fixture did not match");
}

const members = await expectJson<HouseholdMember[]>(
  `/households/${household.id}/members`,
  ownerCookie,
);
const memberRoles = members.map((member) => member.role).sort();
if (
  members.length !== 2 ||
  memberRoles[0] !== "member" ||
  memberRoles[1] !== "owner"
) {
  throw new Error(
    `Household should have one owner and one member, saw roles: ${memberRoles.join(", ")}`,
  );
}

console.log("Authenticated preview profile smoke test passed.");
