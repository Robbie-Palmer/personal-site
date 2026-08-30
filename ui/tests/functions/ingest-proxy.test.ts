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
  it("forwards only allowlisted request headers", async () => {
    const fetchMock = vi.fn(async (_request: Request) => new Response("ok"));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const context = createContext(
      new Request("https://robbiepalmer.me/ingest/e/?ip=1", {
        method: "POST",
        headers: {
          authorization: "Bearer private",
          cookie: "session=private",
          origin: "https://robbiepalmer.me",
          referer: "https://robbiepalmer.me/recipes",
          "content-type": "application/json",
          "user-agent": "test-browser",
          "x-forwarded-for": "192.0.2.1",
          "x-site-identity": "private-user-id",
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
    expect(forwarded.headers.get("origin")).toBeNull();
    expect(forwarded.headers.get("referer")).toBeNull();
    expect(forwarded.headers.get("x-forwarded-for")).toBeNull();
    expect(forwarded.headers.get("x-site-identity")).toBeNull();
    expect(forwarded.headers.get("content-type")).toBe("application/json");
    expect(forwarded.headers.get("user-agent")).toBe("test-browser");
    expect(await forwarded.json()).toEqual({ event: "pageview" });
    expect(JSON.parse(String(logSpy.mock.calls[0]?.[0]))).toMatchObject({
      path: "/e/",
      status: 200,
    });
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
