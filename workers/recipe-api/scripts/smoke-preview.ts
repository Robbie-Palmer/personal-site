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

type CookingInsights = {
  cookModeStarts: number;
  mealsCooked: number;
  distinctRecipesCooked: number;
  recent: Array<{
    id: string;
    completedAt: string | null;
  }>;
};

const databaseURL = requiredEnv("DATABASE_URL");
const siteURL = requiredEnv("BETTER_AUTH_URL");
const apiURL = requiredEnv("PREVIEW_API_URL").replace(/\/$/, "");
const { db, client } = createDb(databaseURL);

async function expectJson<T>(
  path: string,
  init?: RequestInit,
  expectedStatus = 200,
): Promise<T> {
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    const response = await fetch(`${apiURL}${path}`, init);
    if (response.status === expectedStatus) {
      return response.json() as Promise<T>;
    }
    // A freshly deployed Worker can become reachable before its Neon pool has
    // resumed. Retry read-only readiness probes, but never replay mutations.
    if (!init?.method && response.status === 503 && attempt < 10) {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      continue;
    }
    throw new Error(
      `${init?.method ?? "GET"} ${path} returned ${response.status}: ${await response.text()}`,
    );
  }
  throw new Error(`GET ${path} did not become ready`);
}

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
    throw new Error(`Preview sign-in returned no session cookie (${signIn.status})`);
  }
  const cookie = setCookie.split(";")[0];
  if (!cookie) throw new Error("Preview sign-in returned an empty session cookie");
  const headers = {
    cookie,
    origin: siteURL,
    "content-type": "application/json",
  };

  const before = await expectJson<CookingInsights>(
    "/api/profile/cooking-insights",
    { headers: { cookie } },
  );
  const sessionId = crypto.randomUUID();
  const event = {
    sessionId,
    recipeSlug: "weeknight-pasta",
    recipeTitle: "Weeknight pasta",
    servings: 2,
  };

  await expectJson(
    "/api/profile/cooking-insights",
    {
      method: "POST",
      headers,
      body: JSON.stringify({ ...event, event: "started" }),
    },
    201,
  );
  const afterStart = await expectJson<CookingInsights>(
    "/api/profile/cooking-insights",
    { headers: { cookie } },
  );
  if (
    afterStart.cookModeStarts !== before.cookModeStarts + 1 ||
    afterStart.mealsCooked !== before.mealsCooked
  ) {
    throw new Error("Cook-mode start did not update preview insights correctly");
  }

  await expectJson(
    "/api/profile/cooking-insights",
    {
      method: "POST",
      headers,
      body: JSON.stringify({ ...event, event: "completed" }),
    },
    200,
  );
  const afterFinish = await expectJson<CookingInsights>(
    "/api/profile/cooking-insights",
    { headers: { cookie } },
  );
  if (
    afterFinish.cookModeStarts !== before.cookModeStarts + 1 ||
    afterFinish.mealsCooked !== before.mealsCooked + 1 ||
    !afterFinish.recent.some(
      (session) => session.id === sessionId && session.completedAt,
    )
  ) {
    throw new Error("Cook-mode finish did not update preview insights correctly");
  }

  console.log("Preview cooking-insights smoke test passed.");
} finally {
  await client.end({ timeout: 5 });
}
