import { describe, expect, it, vi } from "vitest";
import { onRequest } from "../../../functions/_middleware";

type MarkdownContext = Parameters<typeof onRequest>[0];

function createContext(
  request: Request,
  assetFetch: typeof fetch,
): MarkdownContext {
  return {
    request,
    next: vi.fn(async () => new Response("next")),
    env: { ASSETS: { fetch: assetFetch } },
  };
}

describe("Markdown content-negotiation middleware", () => {
  it("returns a bodyless 304 for a conditional Markdown asset request", async () => {
    const assetFetch = vi.fn(
      async () => new Response(null, { status: 304, headers: { etag: "v1" } }),
    ) as typeof fetch;
    const context = createContext(
      new Request("https://robbiepalmer.me/projects", {
        headers: {
          accept: "text/markdown",
          "if-none-match": "v1",
        },
      }),
      assetFetch,
    );

    const response = await onRequest(context);

    expect(response.status).toBe(304);
    expect(response.body).toBeNull();
    expect(response.headers.get("content-type")).toBe(
      "text/markdown; charset=utf-8",
    );
    expect(response.headers.get("vary")).toBe("Accept, User-Agent");
    const forwarded = vi.mocked(assetFetch).mock.calls[0]?.[0];
    expect(forwarded).toBeInstanceOf(Request);
    if (!(forwarded instanceof Request)) throw new Error("Expected a Request");
    expect(forwarded.url).toBe("https://robbiepalmer.me/projects.md");
    expect(forwarded.headers.get("if-none-match")).toBe("v1");
  });
});
