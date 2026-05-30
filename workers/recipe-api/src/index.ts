import { Hono } from "hono";
import { neon } from "@neondatabase/serverless";

type Bindings = {
  DATABASE_URL: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get("/health", (c) => c.json({ status: "ok" }));

app.get("/recipes", async (c) => {
  if (!c.env.DATABASE_URL) {
    return c.json({ error: "DATABASE_URL is not configured" }, 503);
  }
  try {
    const sql = neon(c.env.DATABASE_URL);
    const rows = await sql`SELECT 1 AS connected`;
    return c.json({ connected: true, rows });
  } catch (e) {
    return c.json(
      { error: "Database connection failed", message: String(e) },
      502,
    );
  }
});

export default app;
