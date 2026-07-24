import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/tests/test-utils";

const navigation = vi.hoisted(() => ({
  pathname: "/recipes/first-soup",
  replaceWithRecipePage: vi.fn(),
  search: "",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

vi.mock("@/components/recipes/recipe-page-link", () => ({
  replaceWithRecipePage: navigation.replaceWithRecipePage,
}));

vi.mock("@/components/recipes/recipe-content", () => ({
  RecipeContent: ({ recipe }: { recipe: { title: string } }) => (
    <div>{recipe.title}</div>
  ),
}));

import { SavedRecipeView } from "@/components/recipes/saved-recipe-view";

const originalFetch = globalThis.fetch;

function record(slug: string, title: string, owned = false) {
  return {
    slug,
    title,
    description: "A useful soup.",
    visibility: "public",
    createdAt: "2026-07-22T12:00:00.000Z",
    updatedAt: "2026-07-22T12:00:00.000Z",
    owned,
    body: JSON.stringify({
      version: 1,
      source: "Simmer @lentils{200%g}.",
      recipe: {
        title,
        description: "A useful soup.",
        date: "2026-07-22",
        cuisine: [],
        servings: 2,
        tags: [],
        ingredientGroups: [
          {
            items: [{ ingredient: "red-lentils", amount: 200, unit: "g" }],
          },
        ],
        instructions: ["Simmer the lentils."],
        cookware: [],
        cookBody: "Simmer @lentils{200%g}.",
      },
    }),
  };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  navigation.pathname = "/recipes/first-soup";
  navigation.search = "";
  navigation.replaceWithRecipePage.mockReset();
  vi.restoreAllMocks();
});

describe("SavedRecipeView", () => {
  it("reloads when client-side navigation changes the recipe pathname", async () => {
    globalThis.fetch = vi.fn(async (input) => {
      const slug = String(input).endsWith("second-soup")
        ? "second-soup"
        : "first-soup";
      return Response.json(
        record(slug, slug === "second-soup" ? "Second Soup" : "First Soup"),
      );
    }) as typeof fetch;

    const view = render(<SavedRecipeView />);
    expect(await screen.findByText("First Soup")).toBeInTheDocument();

    navigation.pathname = "/recipes/second-soup";
    view.rerender(<SavedRecipeView />);

    expect(await screen.findByText("Second Soup")).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenLastCalledWith(
      "/api/recipes/second-soup",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("offers owners a link to edit the recipe", async () => {
    globalThis.fetch = vi.fn(async () =>
      Response.json(record("first-soup", "First Soup", true)),
    ) as typeof fetch;

    render(<SavedRecipeView />);

    expect(await screen.findByText("First Soup")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit recipe" })).toHaveAttribute(
      "href",
      "/recipes/edit?slug=first-soup",
    );
  });

  it("redirects the legacy saved-recipe URL to the unified recipe path", () => {
    globalThis.fetch = vi.fn();
    navigation.pathname = "/recipes/saved";
    navigation.search = "slug=first-soup";

    render(<SavedRecipeView />);

    expect(navigation.replaceWithRecipePage).toHaveBeenCalledWith({
      slug: "first-soup",
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("does not redirect the saved-recipe route without a slug", async () => {
    globalThis.fetch = vi.fn();
    navigation.pathname = "/recipes/saved";

    render(<SavedRecipeView />);

    expect(
      await screen.findByText("No saved recipe was selected."),
    ).toBeInTheDocument();
    expect(navigation.replaceWithRecipePage).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
