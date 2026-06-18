import { describe, it, expect, vi } from "vitest";
import postgres from "postgres";

vi.mock("postgres", () => ({
  default: vi.fn(() => {
    // drizzle-orm/postgres-js/driver.js writes transparent parsers into
    // client.options.parsers / .serializers at construction time, so the mock
    // client must expose those empty objects. Queries go through:
    //   client.unsafe(sql, params).values() — SELECT (drizzle maps array-of-arrays)
    //   client.unsafe(sql, params)          — DML
    const queryResult = (rows: unknown[][] = []) =>
      Object.assign(Promise.resolve(rows), {
        values: () => Promise.resolve(rows),
      });
    const emptyResult = queryResult();
    return Object.assign(
      (_strings: TemplateStringsArray, ..._values: unknown[]) => emptyResult,
      {
        options: { parsers: {}, serializers: {} },
        unsafe: (query: string, params: unknown[] = []) => {
          if (query.startsWith('insert into "verification"')) {
            return queryResult([params]);
          }
          return emptyResult;
        },
        end: (_options?: { timeout?: number }) => Promise.resolve(),
      },
    );
  }),
}));

import app from "../src/index";

const env = {
  DATABASE_URL: "postgresql://test:test@localhost/test",
  BETTER_AUTH_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "test-secret-that-is-at-least-thirty-two-characters",
  GOOGLE_CLIENT_ID: "google-client-id",
  GOOGLE_CLIENT_SECRET: "google-client-secret",
  GITHUB_CLIENT_ID: "github-client-id",
  GITHUB_CLIENT_SECRET: "github-client-secret",
};

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
      error: "No database connection configured (HYPERDRIVE or DATABASE_URL required)",
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

describe("POST /api/auth/sign-in/social", () => {
  it.each(["google", "github"] as const)(
    "uses the public frontend callback for %s",
    async (provider) => {
      const res = await app.request(
        "/api/auth/sign-in/social",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "http://localhost:3000",
          },
          body: JSON.stringify({
            provider,
            callbackURL: "/recipes",
            disableRedirect: true,
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { url: string };
      const providerURL = new URL(body.url);
      expect(providerURL.searchParams.get("redirect_uri")).toBe(
        `http://localhost:3000/api/auth/callback/${provider}`,
      );
    },
  );

  it("returns 503 when the public auth URL is missing", async () => {
    const res = await app.request(
      "/api/auth/sign-in/social",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: "google" }),
      },
      { ...env, BETTER_AUTH_URL: "" },
    );

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: "Auth configuration is incomplete",
    });
  });
});

describe("unknown routes", () => {
  it("returns 404", async () => {
    const res = await app.request("/unknown", {}, env);
    expect(res.status).toBe(404);
  });
});
