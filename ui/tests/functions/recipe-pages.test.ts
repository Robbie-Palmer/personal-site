import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequest } from "../../../functions/recipes/[[path]]";

type Context = Parameters<typeof onRequest>[0];
const originalFetch = globalThis.fetch;

const payload = {
  version: 1,
  source: "Simmer @lentils{200%g} for ~{20%minutes}.",
  recipe: {
    title: "Lentil Soup",
    description: "A useful soup.",
    date: "2026-07-22",
    cuisine: ["Irish"],
    servings: 4,
    prepTime: 10,
    cookTime: 20,
    tags: ["soup"],
    ingredientGroups: [
      { items: [{ ingredient: "red-lentils", amount: 200, unit: "g" }] },
    ],
    instructions: ["Simmer the lentils."],
    cookware: ["pot"],
  },
};

function context(
  url: string,
  headers?: HeadersInit,
  assetFetch: typeof fetch = vi.fn() as unknown as typeof fetch,
): Context {
  return {
    request: new Request(url, { headers }),
    env: {
      RECIPE_API_URL: "https://recipe-api.example.test",
      ASSETS: { fetch: assetFetch },
    },
    next: vi.fn(async () => new Response("next")),
  };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("dynamic recipe pages", () => {
  it("serves the canonical recipe URL as Markdown when negotiated", async () => {
    globalThis.fetch = vi.fn(async () =>
      Response.json({
        slug: "lentil-soup",
        title: "Lentil Soup",
        description: "A useful soup.",
        body: JSON.stringify(payload),
      }),
    ) as typeof fetch;

    const response = await onRequest(
      context("https://robbiepalmer.me/recipes/lentil-soup", {
        accept: "text/markdown",
      }),
    );

    expect(response.headers.get("content-type")).toContain("text/markdown");
    expect(await response.text()).toContain("# Lentil Soup");
  });

  it("serves database-backed JSON-LD and Cooklang twins", async () => {
    globalThis.fetch = vi.fn(async () =>
      Response.json({
        slug: "lentil-soup",
        title: "Lentil Soup",
        description: "A useful soup.",
        body: JSON.stringify(payload),
      }),
    ) as typeof fetch;

    const jsonResponse = await onRequest(
      context("https://robbiepalmer.me/recipes/lentil-soup.json"),
    );
    const cookResponse = await onRequest(
      context("https://robbiepalmer.me/recipes/lentil-soup.cook"),
    );

    expect(await jsonResponse.json()).toMatchObject({
      "@type": "Recipe",
      name: "Lentil Soup",
    });
    expect(await cookResponse.text()).toContain('title: "Lentil Soup"');
  });

  it("serves an indexable HTML shell with recipe-specific metadata", async () => {
    globalThis.fetch = vi.fn(async () =>
      Response.json({
        slug: "lentil-soup",
        title: "Lentil Soup",
        description: "A useful soup.",
        body: JSON.stringify(payload),
      }),
    ) as typeof fetch;
    const assetFetch = vi.fn(
      async () =>
        new Response(
          '<html><head><title>Saved Recipe</title><meta name="description" content="Saved"><meta name="robots" content="noindex, nofollow"></head><body></body></html>',
        ),
    ) as typeof fetch;

    const response = await onRequest(
      context(
        "https://robbiepalmer.me/recipes/lentil-soup",
        { accept: "text/html" },
        assetFetch,
      ),
    );
    const html = await response.text();

    expect(html).toContain("<title>Lentil Soup</title>");
    expect(html).toContain(
      '<link rel="canonical" href="https://robbiepalmer.me/recipes/lentil-soup">',
    );
    expect(html).toContain('type="application/ld+json"');
    expect(html).not.toContain("noindex");
  });

  it("leaves named application routes to their static pages", async () => {
    const requestContext = context(
      "https://robbiepalmer.me/recipes/onboarding",
    );
    const response = await onRequest(requestContext);

    expect(await response.text()).toBe("next");
    expect(requestContext.next).toHaveBeenCalledOnce();
  });
});
