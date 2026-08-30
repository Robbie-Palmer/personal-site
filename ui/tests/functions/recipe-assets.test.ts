import { afterEach, describe, expect, it, vi } from "vitest";
import type { StoredRecipe } from "../../../functions/lib/public-recipes";
import {
  augmentRecipeAsset,
  type RecipeAssetContext,
} from "../../../functions/lib/recipe-asset";

const CACHE_PATH = "/__recipe-assets/public-recipes.json";

function recipe(slug: string, title: string): StoredRecipe {
  return {
    slug,
    title,
    description: null,
    body: null,
    visibility: "public",
  };
}

function cacheDouble(initial?: Record<string, Response>) {
  const entries = new Map(
    Object.entries(initial ?? {}).map(([key, response]) => [
      key,
      response.clone(),
    ]),
  );
  const cache = {
    match: vi.fn(async (request: RequestInfo | URL) => {
      const key = request instanceof Request ? request.url : request.toString();
      return entries.get(key)?.clone();
    }),
    put: vi.fn(async (request: RequestInfo | URL, response: Response) => {
      const key = request instanceof Request ? request.url : request.toString();
      entries.set(key, response.clone());
    }),
  } as unknown as Cache;
  return { cache, entries };
}

function context(url: string, pending: Promise<unknown>[]): RecipeAssetContext {
  return {
    request: new Request(url),
    env: {
      RECIPE_API_URL: "https://recipe-api.example.test",
      ASSETS: {
        fetch: vi.fn(async () => new Response("static asset")) as typeof fetch,
      },
    },
    waitUntil: (promise) => pending.push(promise),
  };
}

function render(asset: string, records: StoredRecipe[]): string {
  return `${asset}: ${records.map((record) => record.title).join(", ")}`;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("recipe asset aggregation cache", () => {
  it("uses a host-scoped cached recipe list without calling the API", async () => {
    const cacheUrl = `https://pr-123.example.test${CACHE_PATH}`;
    const { cache } = cacheDouble({
      [cacheUrl]: Response.json([recipe("cached", "Cached recipe")], {
        headers: { "x-recipe-cache-created-at": String(Date.now()) },
      }),
    });
    const open = vi.fn(async () => cache);
    const apiFetch = vi.fn();
    vi.stubGlobal("caches", { open });
    vi.stubGlobal("fetch", apiFetch);

    const response = await augmentRecipeAsset(
      context("https://pr-123.example.test/llms.txt", []),
      render,
    );

    expect(await response.text()).toBe("static asset: Cached recipe");
    expect(open).toHaveBeenCalledWith("recipe-assets-v1");
    expect(cache.match).toHaveBeenCalledWith(
      expect.objectContaining({ url: cacheUrl }),
    );
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("stores a cache miss for five minutes and reuses it across assets", async () => {
    const { cache } = cacheDouble();
    const open = vi.fn(async () => cache);
    const apiFetch = vi.fn(async () =>
      Response.json({
        items: [recipe("fresh", "Fresh recipe")],
        nextCursor: null,
      }),
    );
    vi.stubGlobal("caches", { open });
    vi.stubGlobal("fetch", apiFetch);
    const pending: Promise<unknown>[] = [];

    const first = await augmentRecipeAsset(
      context("https://robbiepalmer.me/sitemap.xml", pending),
      render,
    );
    await Promise.all(pending);
    const second = await augmentRecipeAsset(
      context("https://robbiepalmer.me/llms-full.txt", []),
      render,
    );

    expect(await first.text()).toBe("static asset: Fresh recipe");
    expect(await second.text()).toBe("static asset: Fresh recipe");
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(cache.put).toHaveBeenCalledTimes(1);
    const [cacheKey, cachedResponse] = vi.mocked(cache.put).mock.calls[0] ?? [];
    expect(cacheKey).toEqual(
      expect.objectContaining({
        url: `https://robbiepalmer.me${CACHE_PATH}`,
      }),
    );
    expect(cachedResponse?.headers.get("cache-control")).toBe(
      "public, s-maxage=300",
    );
    expect(first.headers.get("cache-control")).toBe(
      "public, max-age=60, s-maxage=300",
    );
  });

  it("does not stack aggregate and rendered asset cache lifetimes", async () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    const cacheUrl = `https://robbiepalmer.me${CACHE_PATH}`;
    const { cache } = cacheDouble({
      [cacheUrl]: Response.json([recipe("cached", "Cached recipe")], {
        headers: {
          "x-recipe-cache-created-at": String(now - 4 * 60_000),
        },
      }),
    });
    vi.stubGlobal("caches", { open: vi.fn(async () => cache) });
    vi.stubGlobal("fetch", vi.fn());

    const response = await augmentRecipeAsset(
      context("https://robbiepalmer.me/llms.txt", []),
      render,
    );

    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=60, s-maxage=60",
    );
  });

  it("coalesces concurrent cache misses from different recipe assets", async () => {
    const { cache } = cacheDouble();
    vi.stubGlobal("caches", { open: vi.fn(async () => cache) });
    let resolveApi: ((response: Response) => void) | undefined;
    const apiResponse = new Promise<Response>((resolve) => {
      resolveApi = resolve;
    });
    const apiFetch = vi.fn(() => apiResponse);
    vi.stubGlobal("fetch", apiFetch);
    const firstPending: Promise<unknown>[] = [];
    const secondPending: Promise<unknown>[] = [];

    const first = augmentRecipeAsset(
      context("https://robbiepalmer.me/sitemap.xml", firstPending),
      render,
    );
    const second = augmentRecipeAsset(
      context("https://robbiepalmer.me/llms.txt", secondPending),
      render,
    );
    await vi.waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    resolveApi?.(
      Response.json({
        items: [recipe("shared", "Shared recipe")],
        nextCursor: null,
      }),
    );

    const responses = await Promise.all([first, second]);
    await Promise.all([...firstPending, ...secondPending]);
    expect(await responses[0].text()).toContain("Shared recipe");
    expect(await responses[1].text()).toContain("Shared recipe");
    expect(cache.put).toHaveBeenCalledTimes(1);
  });

  it("serves the asset when cache reads and writes fail", async () => {
    const cache = {
      match: vi.fn(async () => {
        throw new Error("cache read failed");
      }),
      put: vi.fn(async () => {
        throw new Error("cache write failed");
      }),
    } as unknown as Cache;
    vi.stubGlobal("caches", { open: vi.fn(async () => cache) });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          items: [recipe("fallback", "Fallback recipe")],
          nextCursor: null,
        }),
      ),
    );
    const pending: Promise<unknown>[] = [];

    const response = await augmentRecipeAsset(
      context("https://robbiepalmer.me/llms.txt", pending),
      render,
    );
    await Promise.all(pending);

    expect(await response.text()).toBe("static asset: Fallback recipe");
  });
});
