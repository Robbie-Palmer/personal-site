import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequest } from "../../../functions/api/profile/diet";
import { onRequest as onOptionsRequest } from "../../../functions/api/profile/diet/options";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("profile diet proxy", () => {
  it("forwards same-origin diet profile requests to the recipe API Worker", async () => {
    const fetchMock = vi.fn(async (_request: Request) => new Response("ok"));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const response = await onRequest({
      request: new Request("https://robbiepalmer.me/api/profile/diet?fresh=1", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          host: "robbiepalmer.me",
        },
        body: JSON.stringify({ recipeMatchMode: "warn" }),
      }),
      env: { RECIPE_API_URL: "https://recipe-api.example.test" },
    } as never);

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
    const forwarded = fetchMock.mock.calls[0]?.[0];
    expect(forwarded).toBeInstanceOf(Request);
    if (!(forwarded instanceof Request)) {
      throw new Error("Expected profile proxy to forward a Request");
    }
    expect(forwarded.url).toBe(
      "https://recipe-api.example.test/api/profile/diet?fresh=1",
    );
    expect(forwarded.method).toBe("PUT");
    expect(forwarded.headers.has("host")).toBe(false);
  });

  it("rejects non-canonical preview aliases", async () => {
    const response = await onRequest({
      request: new Request(
        "https://abc123.personal-site-bu5.pages.dev/api/profile/diet",
      ),
      env: {
        CF_PAGES_HOST: "personal-site-bu5.pages.dev",
        RECIPE_API_PREVIEW_ORIGIN_TEMPLATE:
          "https://recipe-api-pr-{pr}.example.test",
      },
    } as never);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Profile APIs are available on the canonical PR preview URL only",
    });
  });

  it("forwards diet options requests to the recipe API Worker", async () => {
    const fetchMock = vi.fn(async (_request: Request) => new Response("ok"));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const response = await onOptionsRequest({
      request: new Request("https://robbiepalmer.me/api/profile/diet/options"),
      env: { RECIPE_API_URL: "https://recipe-api.example.test" },
    } as never);

    expect(response.status).toBe(200);
    const forwarded = fetchMock.mock.calls[0]?.[0];
    expect(forwarded).toBeInstanceOf(Request);
    if (!(forwarded instanceof Request)) {
      throw new Error("Expected diet options proxy to forward a Request");
    }
    expect(forwarded.url).toBe(
      "https://recipe-api.example.test/api/profile/diet/options",
    );
  });
});
