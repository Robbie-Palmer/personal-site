import { describe, expect, it, vi } from "vitest";
import {
  fetchRecipePage,
  RecipeUrlImportError,
  validateRecipeUrl,
} from "../src/recipe-url-import";

describe("validateRecipeUrl", () => {
  it.each([
    "file:///etc/passwd",
    "http://localhost/recipe",
    "http://127.0.0.1/recipe",
    "http://10.1.2.3/recipe",
    "http://[::1]/recipe",
    "https://example.com:8443/recipe",
    "https://user:secret@example.com/recipe",
  ])("rejects unsafe URL %s", (url) => {
    expect(() => validateRecipeUrl(url)).toThrow(RecipeUrlImportError);
  });

  it("allows a public HTTP URL", () => {
    expect(validateRecipeUrl("https://recipes.example.com/pasta").toString()).toBe(
      "https://recipes.example.com/pasta",
    );
  });
});

describe("fetchRecipePage", () => {
  it("follows validated redirects and returns HTML", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: "/final" } }),
      )
      .mockResolvedValueOnce(
        new Response("<html>recipe</html>", {
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );

    await expect(
      fetchRecipePage("https://recipes.example.com/start", fetcher),
    ).resolves.toEqual({
      html: "<html>recipe</html>",
      url: "https://recipes.example.com/final",
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("rejects a redirect to a private address", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "http://127.0.0.1/private" },
      }),
    );

    await expect(
      fetchRecipePage("https://recipes.example.com/start", fetcher),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects non-HTML and oversized responses", async () => {
    await expect(
      fetchRecipePage(
        "https://recipes.example.com/file",
        vi.fn<typeof fetch>().mockResolvedValue(
          new Response("{}", { headers: { "content-type": "application/json" } }),
        ),
      ),
    ).rejects.toMatchObject({ status: 415 });

    await expect(
      fetchRecipePage(
        "https://recipes.example.com/huge",
        vi.fn<typeof fetch>().mockResolvedValue(
          new Response("small", {
            headers: {
              "content-length": "3000000",
              "content-type": "text/html",
            },
          }),
        ),
      ),
    ).rejects.toMatchObject({ status: 413 });
  });
});
