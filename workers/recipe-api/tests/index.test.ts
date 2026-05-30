import { describe, it, expect, vi } from "vitest";
import { neon } from "@neondatabase/serverless";

vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn(() => {
    // drizzle-orm/neon-http calls client(sql, params, { fullResults: true }) as a plain
    // function and destructures { rows, fields } from the result.
    const sql = (_query: unknown, ..._rest: unknown[]) =>
      Promise.resolve({ rows: [], fields: [] });
    return sql;
  }),
}));

import app from "../src/index";

const env = { DATABASE_URL: "postgresql://test:test@localhost/test" };

describe("GET /health", () => {
  it("returns ok", async () => {
    const res = await app.request("/health", {}, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});

describe("GET /recipes", () => {
  it("returns recipes list", async () => {
    const res = await app.request("/recipes", {}, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("returns 503 when no connection is configured", async () => {
    const res = await app.request("/recipes", {}, { DATABASE_URL: "" });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: "DATABASE_URL is not configured",
    });
  });

  it("returns 502 when database query fails", async () => {
    vi.mocked(neon).mockReturnValueOnce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((_query: unknown) => Promise.reject(new Error("connection refused"))) as any,
    );

    const res = await app.request("/recipes", {}, env);
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Database query failed");
  });
});

describe("unknown routes", () => {
  it("returns 404", async () => {
    const res = await app.request("/unknown", {}, env);
    expect(res.status).toBe(404);
  });
});
