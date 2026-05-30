import { describe, it, expect, vi } from "vitest";

vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn(() => {
    const sql = (strings: TemplateStringsArray) =>
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
});

describe("unknown routes", () => {
  it("returns 404", async () => {
    const res = await app.request("/unknown", {}, env);
    expect(res.status).toBe(404);
  });
});
