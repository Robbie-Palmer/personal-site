import { describe, it, expect, vi } from "vitest";
import { neon } from "@neondatabase/serverless";

vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn(() => {
    const sql = (_strings: TemplateStringsArray, ..._values: unknown[]) =>
      Promise.resolve([{ connected: 1 }]);
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
  it("returns connection status", async () => {
    const res = await app.request("/recipes", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ connected: true, rows: [{ connected: 1 }] });
  });

  it("returns 503 when DATABASE_URL is missing", async () => {
    const res = await app.request("/recipes", {}, { DATABASE_URL: "" });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: "DATABASE_URL is not configured",
    });
  });

  it("returns 502 when database query fails", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(neon).mockReturnValueOnce((() => {
      throw new Error("connection refused");
    }) as any);

    const res = await app.request("/recipes", {}, env);
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Database connection failed");
  });
});

describe("unknown routes", () => {
  it("returns 404", async () => {
    const res = await app.request("/unknown", {}, env);
    expect(res.status).toBe(404);
  });
});
