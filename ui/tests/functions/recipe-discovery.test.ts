import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequest as llms } from "../../../functions/llms.txt";
import { onRequest as llmsFull } from "../../../functions/llms-full.txt";
import { onRequest as sitemap } from "../../../functions/sitemap.xml";

type HandlerContext = Parameters<typeof llms>[0];
const originalFetch = globalThis.fetch;

const payload = {
  version: 1,
  source: "Simmer @lentils{200%g} for ~{20%minutes}.",
  recipe: {
    title: "Lentil [Soup]",
    description: "A useful\nweeknight soup.",
    date: "2026-07-22",
    cuisine: ["Irish"],
    servings: 4,
    prepTime: 10,
    cookTime: 20,
    tags: ["soup"],
    ingredientGroups: [
      {
        items: [
          {
            ingredient: "red-lentils",
            amount: 200,
            unit: "g",
          },
        ],
      },
    ],
    instructions: ["Simmer the lentils."],
    cookware: ["pot"],
    cookBody: "Simmer @lentils{200%g} for ~{20%minutes}.",
  },
};

const storedRecipe = {
  slug: "lentil-soup",
  title: "Lentil Soup",
  description: "A useful weeknight soup.",
  body: JSON.stringify(payload),
  visibility: "public",
  createdAt: "2026-07-21T12:00:00.000Z",
  updatedAt: "2026-07-22T12:00:00.000Z",
};

function context(url: string, asset: Response, method = "GET"): HandlerContext {
  return {
    request: new Request(url, { method }),
    env: {
      RECIPE_API_URL: "https://recipe-api.example.test",
      ASSETS: { fetch: vi.fn(async () => asset) as typeof fetch },
    },
  };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("runtime public recipe discovery", () => {
  it("adds database-backed public recipes to the sitemap", async () => {
    globalThis.fetch = vi.fn(async () =>
      Response.json({ items: [storedRecipe], nextCursor: null }),
    ) as typeof fetch;
    const response = await sitemap(
      context(
        "https://robbiepalmer.me/sitemap.xml",
        new Response('<?xml version="1.0"?><urlset><url></url></urlset>', {
          headers: {
            etag: "static",
            "content-length": "50",
            "content-encoding": "gzip",
          },
        }),
      ),
    );
    const body = await response.text();

    expect(body).toContain(
      "<loc>https://robbiepalmer.me/recipes/lentil-soup</loc>",
    );
    expect(body).toContain("<lastmod>2026-07-22T12:00:00.000Z</lastmod>");
    expect(response.headers.has("etag")).toBe(false);
    expect(response.headers.has("content-length")).toBe(false);
    expect(response.headers.has("content-encoding")).toBe(false);
  });

  it("indexes public recipe Markdown twins in llms.txt", async () => {
    globalThis.fetch = vi.fn(async () =>
      Response.json({ items: [storedRecipe], nextCursor: null }),
    ) as typeof fetch;
    const response = await llms(
      context(
        "https://robbiepalmer.me/llms.txt",
        new Response("# Robbie Palmer\n\n## Recipes\n"),
      ),
    );

    expect(await response.text()).toContain(
      "[Lentil \\[Soup\\]](https://robbiepalmer.me/recipes/lentil-soup.md): A useful weeknight soup.",
    );
  });

  it("includes full public recipe content in llms-full.txt", async () => {
    globalThis.fetch = vi.fn(async () =>
      Response.json({ items: [storedRecipe], nextCursor: null }),
    ) as typeof fetch;
    const response = await llmsFull(
      context(
        "https://robbiepalmer.me/llms-full.txt",
        new Response("# Existing pages\n"),
      ),
    );
    const body = await response.text();

    expect(body).toContain("# Lentil [Soup]");
    expect(body).toContain("- 200g red lentils");
    expect(body).toContain("## Cookware");
  });

  it("falls back to the static asset when the API fails", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("offline");
    }) as typeof fetch;
    const asset = new Response("static index");

    expect(await llms(context("https://robbiepalmer.me/llms.txt", asset))).toBe(
      asset,
    );
  });

  it("does not query the API for HEAD requests", async () => {
    const apiFetch = vi.fn();
    globalThis.fetch = apiFetch as typeof fetch;
    const asset = new Response(null, { headers: { etag: "static" } });

    expect(
      await sitemap(
        context("https://robbiepalmer.me/sitemap.xml", asset, "HEAD"),
      ),
    ).toBe(asset);
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
