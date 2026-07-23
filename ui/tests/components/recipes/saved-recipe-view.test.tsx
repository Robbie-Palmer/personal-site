import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/recipes/first-soup" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(),
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
});
