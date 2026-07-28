import { describe, expect, it, vi } from "vitest";
import type { Env } from "../src/env";

vi.mock("cloudflare:workers", () => ({
  WorkflowEntrypoint: class {},
}));

vi.mock("cloudflare:workflows", () => ({
  NonRetryableError: class extends Error {},
}));

import handler from "../src/index";

const ctx = {
  waitUntil: vi.fn(),
} as unknown as ExecutionContext;
const env = {} as Env;

describe("recipe ingest Worker", () => {
  it("returns its health response through the tracing wrapper", async () => {
    const response = await handler.fetch(
      new Request("https://recipe-ingest.example.test/health"),
      env,
      ctx,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      service: "recipe-ingest",
    });
  });

  it("returns not found for unknown paths", async () => {
    const response = await handler.fetch(
      new Request("https://recipe-ingest.example.test/unknown"),
      env,
      ctx,
    );

    expect(response.status).toBe(404);
  });
});
