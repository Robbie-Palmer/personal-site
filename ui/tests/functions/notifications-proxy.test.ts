import { afterEach, describe, expect, it, vi } from "vitest";
import type { RecipeApiProxyContext } from "../../../functions/api/auth/routing";
import { onRequest } from "../../../functions/api/notifications/[[path]]";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("notifications proxy", () => {
  it.each([
    ["/api/notifications?fresh=1", "/notifications?fresh=1"],
    ["/api/notifications/read-all", "/notifications/read-all"],
    ["/api/notifications/notification-1", "/notifications/notification-1"],
    [
      "/api/notifications/notification-1/actions/accept",
      "/notifications/notification-1/actions/accept",
    ],
  ])("maps %s to the Worker path %s", async (sourcePath, workerPath) => {
    const fetchMock = vi.fn(async (_request: Request) => new Response("ok"));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const response = await onRequest({
      request: new Request(`https://robbiepalmer.me${sourcePath}`, {
        method: sourcePath.includes("/actions/")
          ? "POST"
          : sourcePath.includes("notification-1")
            ? "PATCH"
            : "GET",
        headers: { cookie: "session=test" },
      }),
      env: { RECIPE_API_URL: "https://recipe-api.example.test" },
    } satisfies RecipeApiProxyContext);

    expect(response.status).toBe(200);
    const forwarded = fetchMock.mock.calls[0]?.[0];
    expect(forwarded).toBeInstanceOf(Request);
    if (!(forwarded instanceof Request)) throw new Error("Expected a Request");
    expect(forwarded.url).toBe(`https://recipe-api.example.test${workerPath}`);
    expect(forwarded.headers.get("cookie")).toBe("session=test");
  });
});
