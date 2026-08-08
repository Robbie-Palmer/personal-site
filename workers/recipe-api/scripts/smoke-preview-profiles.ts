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

type FollowStatus = {
  following: boolean;
  canFollow: boolean;
};

type CookConnection = {
  id: string;
  name: string;
};

type PublicCookProfile = {
  id: string;
  followers: CookConnection[];
  following: CookConnection[];
};

type DiscoverFeed = {
  items: Array<{ recipe: { slug: string }; author: { id: string } }>;
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

async function expectJson<T>(
  path: string,
  cookie: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("cookie", cookie);
  const response = await fetchWhenReady(path, { ...init, headers });
  if (response.ok) return response.json() as Promise<T>;
  throw new Error(
    `${init?.method ?? "GET"} ${path} returned ${response.status}: ${await response.text()}`,
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
await expectAuthenticationRequired("/recipes/discover/feed?scope=following");

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

// Household owner scenario. The household routes accept only UUID-form
// `householdId`/`memberId`, so drive them end to end — resolve the household,
// then read its members — to confirm the seeded household is reachable through
// the API rather than merely present in the database.
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

// The ID must be a UUID — that is exactly what the household routes require —
// and validating it before building the request path keeps untrusted response
// data out of the URL.
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!uuidPattern.test(household.id)) {
  throw new Error(`Household ID is not a UUID: ${household.id}`);
}

const members = await expectJson<HouseholdMember[]>(
  `/households/${encodeURIComponent(household.id)}/members`,
  ownerCookie,
);
const memberRoles = members
  .map((member) => member.role)
  .sort((a, b) => a.localeCompare(b));
if (
  members.length !== 2 ||
  memberRoles[0] !== "member" ||
  memberRoles[1] !== "owner"
) {
  throw new Error(
    `Household should have one owner and one member, saw roles: ${memberRoles.join(", ")}`,
  );
}

// Cross-household social graph. The solo recipes cook and household owner are
// seeded as reciprocal follows, while only the owner's public recipe may cross
// the household boundary.
const recipesCookie = await createSessionCookie(
  "recipes-user@preview.invalid",
);
const cooks = await expectJson<{
  cooks: Array<{ id: string; name: string }>;
}>("/recipes/cooks", recipesCookie);
const recipesCook = cooks.cooks.find(
  (cook) => cook.name === "User with recipes",
);
const ownerCook = cooks.cooks.find((cook) => cook.name === "Household owner");
if (!recipesCook || !ownerCook) {
  throw new Error("Cross-household public cook fixtures were not available");
}
if (members.some((member) => member.userId === recipesCook.id)) {
  throw new Error("Solo recipes cook unexpectedly belongs to the household");
}

const ownerFollowsRecipes = await expectJson<FollowStatus>(
  `/recipes/cooks/${recipesCook.id}/follow`,
  ownerCookie,
);
const recipesFollowsOwner = await expectJson<FollowStatus>(
  `/recipes/cooks/${ownerCook.id}/follow`,
  recipesCookie,
);
if (!ownerFollowsRecipes.following || !recipesFollowsOwner.following) {
  throw new Error("Cross-household reciprocal follow fixture did not match");
}

const ownerProfile = await expectJson<{ cook: PublicCookProfile }>(
  `/recipes/cooks?cook=${ownerCook.id}`,
  recipesCookie,
);
const recipesProfile = await expectJson<{ cook: PublicCookProfile }>(
  `/recipes/cooks?cook=${recipesCook.id}`,
  ownerCookie,
);
if (
  !ownerProfile.cook.followers.some((cook) => cook.id === recipesCook.id) ||
  !ownerProfile.cook.following.some((cook) => cook.id === recipesCook.id) ||
  !recipesProfile.cook.followers.some((cook) => cook.id === ownerCook.id) ||
  !recipesProfile.cook.following.some((cook) => cook.id === ownerCook.id)
) {
  throw new Error("Public cook profiles did not expose reciprocal follows");
}

const recipesFollowingFeed = await expectJson<DiscoverFeed>(
  "/recipes/discover/feed?scope=following",
  recipesCookie,
);
if (
  !recipesFollowingFeed.items.some(
    (item) =>
      item.author.id === ownerCook.id &&
      item.recipe.slug === "preview-public-household-flatbread",
  )
) {
  throw new Error("Solo cook feed did not include the followed owner's public recipe");
}
if (
  recipesFollowingFeed.items.some(
    (item) => item.recipe.slug === "preview-household-veggie-curry",
  )
) {
  throw new Error("Household-only recipe leaked to an outside follower");
}

const ownerFollowingFeed = await expectJson<DiscoverFeed>(
  "/recipes/discover/feed?scope=following",
  ownerCookie,
);
if (
  !ownerFollowingFeed.items.some(
    (item) =>
      item.author.id === recipesCook.id &&
      item.recipe.slug === "preview-public-tomato-toast",
  ) ||
  !ownerFollowingFeed.items.some(
    (item) => item.recipe.slug === "preview-household-veggie-curry",
  )
) {
  throw new Error(
    "Household owner feed did not combine followed public and household activity",
  );
}

// Keep mutation coverage independent from the seeded reciprocal relationship.
const emptyInitialFollow = await expectJson<FollowStatus>(
  `/recipes/cooks/${ownerCook.id}/follow`,
  cookie,
);
if (!emptyInitialFollow.canFollow || emptyInitialFollow.following) {
  throw new Error("Empty-account follow fixture did not start unfollowed");
}
const emptyFollowed = await expectJson<FollowStatus>(
  `/recipes/cooks/${ownerCook.id}/follow`,
  cookie,
  { method: "PUT", headers: { origin: siteURL } },
);
if (!emptyFollowed.following) {
  throw new Error("Empty account could not follow the household owner");
}
const emptyUnfollowed = await expectJson<FollowStatus>(
  `/recipes/cooks/${ownerCook.id}/follow`,
  cookie,
  { method: "DELETE", headers: { origin: siteURL } },
);
if (emptyUnfollowed.following) {
  throw new Error("Empty account could not clean up its preview follow");
}

console.log("Authenticated preview profile smoke test passed.");
