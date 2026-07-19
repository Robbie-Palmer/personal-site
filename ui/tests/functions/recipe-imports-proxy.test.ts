import { afterEach, describe, expect, it, vi } from "vitest";
import type { RecipeApiProxyContext } from "../../../functions/api/auth/routing";
import { onRequest } from "../../../functions/api/recipe-imports/[[path]]";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
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
});
