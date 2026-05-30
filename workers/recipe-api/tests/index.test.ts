import { describe, it, expect, vi } from "vitest";
import postgres from "postgres";

vi.mock("postgres", () => ({
  default: vi.fn(() => {
    // drizzle-orm/postgres-js/driver.js writes transparent parsers into
    // client.options.parsers / .serializers at construction time, so the mock
    // client must expose those empty objects. Queries go through:
    //   client.unsafe(sql, params).values() — SELECT (drizzle maps array-of-arrays)
    //   client.unsafe(sql, params)          — DML
    const emptyResult = Object.assign(Promise.resolve([]), {
      values: () => Promise.resolve([]),
    });
    return Object.assign(
      (_strings: TemplateStringsArray, ..._values: unknown[]) => emptyResult,
      {
        options: { parsers: {}, serializers: {} },
        unsafe: (_query: string, _params?: unknown[]) => emptyResult,
        end: (_options?: { timeout?: number }) => Promise.resolve(),
      },
    );
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
    vi.mocked(postgres).mockReturnValueOnce(
      Object.assign(
        () => {},
        {
          options: { parsers: {}, serializers: {} },
          unsafe: () => ({
            values: () => Promise.reject(new Error("connection refused")),
          }),
          end: () => Promise.resolve(),
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ) as any,
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
