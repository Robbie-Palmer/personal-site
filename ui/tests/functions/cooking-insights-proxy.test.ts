import { afterEach, describe, expect, it, vi } from "vitest";
import type { RecipeApiProxyContext } from "../../../functions/api/auth/routing";
import { onRequest } from "../../../functions/api/profile/cooking-insights";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("cooking insights proxy", () => {
  it("forwards the profile request to the recipe API", async () => {
    const fetchMock = vi.fn(async (_request: Request) => new Response("ok"));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const response = await onRequest({
      request: new Request(
        "https://robbiepalmer.me/api/profile/cooking-insights",
        {
          method: "POST",
          headers: { cookie: "session=test" },
          body: JSON.stringify({ event: "started" }),
        },
      ),
      env: { RECIPE_API_URL: "https://recipe-api.example.test" },
    } satisfies RecipeApiProxyContext);

    expect(response.status).toBe(200);
    const forwarded = fetchMock.mock.calls[0]?.[0];
    expect(forwarded).toBeInstanceOf(Request);
    if (!(forwarded instanceof Request)) throw new Error("Expected a Request");
    expect(forwarded.url).toBe(
      "https://recipe-api.example.test/api/profile/cooking-insights",
    );
    expect(forwarded.headers.get("cookie")).toBe("session=test");
  });
});
