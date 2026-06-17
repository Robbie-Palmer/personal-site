import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { createDb, schema } from "./db";
import { createAuth } from "./auth";

type Bindings = {
  HYPERDRIVE?: Hyperdrive;
  DATABASE_URL?: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  BETTER_AUTH_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get("/health", (c) => c.json({ status: "ok" }));

// TODO: remove after verifying production OAuth works end-to-end
app.get("/auth-test", (c) => {
  return c.html(`<!DOCTYPE html>
<html><head><title>Auth Test</title></head><body>
<h2>OAuth Test</h2>
<button onclick="signIn('google')">Sign in with Google</button>
<button onclick="signIn('github')">Sign in with GitHub</button>
<button onclick="getSession()">Get Session</button>
<pre id="out"></pre>
<script>
async function signIn(provider) {
  const res = await fetch('/api/auth/sign-in/social', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, callbackURL: '/auth-test' }),
  });
  const data = await res.json();
  if (data.url) window.location.href = data.url;
  else document.getElementById('out').textContent = JSON.stringify(data, null, 2);
}
async function getSession() {
  const res = await fetch('/api/auth/get-session');
  const data = await res.json();
  document.getElementById('out').textContent = JSON.stringify(data, null, 2);
}
</script>
</body></html>`);
});

app.on(["POST", "GET"], "/api/auth/**", async (c) => {
  const connectionString =
    c.env.HYPERDRIVE?.connectionString ?? c.env.DATABASE_URL;
  if (!connectionString) {
    return c.json({ error: "No database connection configured" }, 503);
  }
  const { db, client } = createDb(connectionString);
  try {
    const baseURL = new URL(c.req.url).origin;
    const auth = createAuth(db, baseURL, c.env);
    return await auth.handler(c.req.raw);
  } finally {
    try {
      await client.end({ timeout: 5 });
    } catch (e) {
      console.error("client.end() cleanup failed", e);
    }
  }
});

app.get("/recipes", async (c) => {
  const connectionString =
    c.env.HYPERDRIVE?.connectionString ?? c.env.DATABASE_URL;
  if (!connectionString) {
    return c.json(
      { error: "No database connection configured (HYPERDRIVE or DATABASE_URL required)" },
      503,
    );
  }
  const { db, client } = createDb(connectionString);
  try {
    const recipes = await db
      .select()
      .from(schema.recipe)
      .where(eq(schema.recipe.visibility, "public"));
    return c.json(recipes);
  } catch (e) {
    console.error("GET /recipes query failed", e);
    return c.json({ error: "Database query failed" }, 502);
  } finally {
    try {
      await client.end({ timeout: 5 });
    } catch (e) {
      console.error("client.end() cleanup failed", e);
    }
  }
});

export default app;
