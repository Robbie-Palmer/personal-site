import { afterEach, describe, expect, it, vi } from "vitest";
import type { RecipeApiProxyContext } from "../../../functions/api/auth/routing";
import { onRequest } from "../../../functions/api/recipe-imports/[[path]]";

const withPostHogSpanMock = vi.hoisted(() =>
  vi.fn(
    async (_options: unknown, operation: (span: unknown) => Promise<unknown>) =>
      operation({}),
  ),
);

vi.mock("observability", async (importOriginal) => ({
  ...(await importOriginal<typeof import("observability")>()),
  traceCarrierFromSpan: () => undefined,
  withPostHogSpan: withPostHogSpanMock,
}));

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  withPostHogSpanMock.mockClear();
  vi.restoreAllMocks();
});

describe("recipe imports proxy", () => {
  it("maps the Pages API path to the Worker import path", async () => {
    const fetchMock = vi.fn(async (_request: Request) => new Response("ok"));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const context: RecipeApiProxyContext = {
      request: new Request(
        "https://robbiepalmer.me/api/recipe-imports/123?fresh=1",
        { headers: { cookie: "session=test" } },
      ),
      env: { RECIPE_API_URL: "https://recipe-api.example.test" },
    };

    const response = await onRequest(context);

    expect(response.status).toBe(200);
    const forwarded = fetchMock.mock.calls[0]?.[0];
    expect(forwarded).toBeInstanceOf(Request);
    if (!(forwarded instanceof Request)) throw new Error("Expected a Request");
    expect(forwarded.url).toBe(
      "https://recipe-api.example.test/recipe-imports/123?fresh=1",
    );
    expect(forwarded.headers.get("cookie")).toBe("session=test");
  });

  it("defers telemetry export through the Pages execution context", async () => {
    const pending: Promise<unknown>[] = [];
    globalThis.fetch = vi.fn(async () => new Response("ok"));
    const context: RecipeApiProxyContext = {
      request: new Request("https://robbiepalmer.me/api/recipe-imports/123"),
      env: {
        RECIPE_API_URL: "https://recipe-api.example.test",
      },
      waitUntil: (promise) => pending.push(promise),
    };

    const response = await onRequest(context);

    expect(response.status).toBe(200);
    const spanOptions = withPostHogSpanMock.mock.calls.at(-1)?.[0] as {
      waitUntil?: { waitUntil: (promise: Promise<unknown>) => void };
    };
    spanOptions.waitUntil?.waitUntil(Promise.resolve());
    expect(pending).toHaveLength(1);
    await Promise.all(pending);
  });
});
