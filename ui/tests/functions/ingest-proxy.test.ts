import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequest } from "../../../functions/ingest/[[path]]";

type IngestContext = Parameters<typeof onRequest>[0];
const originalFetch = globalThis.fetch;

function createContext(request: Request): IngestContext {
  return {
    request,
    env: {
      POSTHOG_API_HOST: "https://posthog.example.test",
      POSTHOG_ASSETS_HOST: "https://posthog-assets.example.test",
    },
  };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("PostHog ingest proxy", () => {
  it("forwards the request without first-party credentials", async () => {
    const fetchMock = vi.fn(async (_request: Request) => new Response("ok"));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    vi.spyOn(console, "log").mockImplementation(() => {});
    const context = createContext(
      new Request("https://robbiepalmer.me/ingest/e/?ip=1", {
        method: "POST",
        headers: {
          authorization: "Bearer private",
          cookie: "session=private",
          "content-type": "application/json",
          "x-forwarded-for": "192.0.2.1",
        },
        body: JSON.stringify({ event: "pageview" }),
      }),
    );

    const response = await onRequest(context);

    expect(response.status).toBe(200);
    const forwarded = fetchMock.mock.calls[0]?.[0];
    expect(forwarded).toBeInstanceOf(Request);
    if (!(forwarded instanceof Request)) throw new Error("Expected a Request");
    expect(forwarded.url).toBe("https://posthog.example.test/e/?ip=1");
    expect(forwarded.headers.get("authorization")).toBeNull();
    expect(forwarded.headers.get("cookie")).toBeNull();
    expect(forwarded.headers.get("x-forwarded-for")).toBeNull();
    expect(forwarded.headers.get("content-type")).toBe("application/json");
    expect(await forwarded.json()).toEqual({ event: "pageview" });
  });

  it("returns a generic 502 when the upstream request fails", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("private upstream detail");
    }) as unknown as typeof fetch;
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await onRequest(
      createContext(new Request("https://robbiepalmer.me/ingest/e/")),
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "Analytics upstream unavailable",
    });
  });
});
