import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { createDb, schema } from "./db";

type Bindings = {
  // Production: Cloudflare Hyperdrive binding (connection pooling).
  // Local dev: set DATABASE_URL in .dev.vars instead.
  // Fallback: if Hyperdrive is ever unavailable, swap the postgres.js driver
  // for @neondatabase/serverless which uses Neon's WebSocket protocol and
  // handles its own connection pooling via Neon's proxy.
  HYPERDRIVE?: Hyperdrive;
  DATABASE_URL?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get("/health", (c) => c.json({ status: "ok" }));

app.get("/recipes", async (c) => {
  const connectionString =
    c.env.HYPERDRIVE?.connectionString ?? c.env.DATABASE_URL;
  if (!connectionString) {
    return c.json({ error: "DATABASE_URL is not configured" }, 503);
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
    await client.end({ timeout: 5 });
  }
});

export default app;
