import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearOtherPrivateRecipeQueries } from "@/lib/query/recipe-query-client";
import { recipeQueryKeys } from "@/lib/query/recipe-query-keys";
import { render, screen } from "@/tests/test-utils";

const navigation = vi.hoisted(() => ({
  pathname: "/recipes/first-soup",
  search: "",
}));

const auth = vi.hoisted(() => ({
  session: { data: null, isPending: false },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => auth.session },
}));

vi.mock("@/components/recipes/recipe-content", () => ({
  RecipeContent: ({ recipe }: { recipe: { title: string } }) => (
    <div>{recipe.title}</div>
  ),
}));

import { SavedRecipeView } from "@/components/recipes/saved-recipe-view";

const originalFetch = globalThis.fetch;

function record(
  slug: string,
  title: string,
  owned = false,
  visibility: "public" | "private" | "household" = "public",
) {
  return {
    slug,
    title,
    description: "A useful soup.",
    visibility,
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
  vi.restoreAllMocks();
});

beforeEach(() => {
  auth.session = { data: null, isPending: false };
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

  it("offers sharing only for readable non-private recipes", async () => {
    globalThis.fetch = vi.fn(async () =>
      Response.json(record("first-soup", "First Soup")),
    ) as typeof fetch;
    const view = render(<SavedRecipeView />);

    expect(
      await screen.findByRole("button", { name: "Share" }),
    ).toBeInTheDocument();

    globalThis.fetch = vi.fn(async () =>
      Response.json(record("first-soup", "First Soup", true, "private")),
    ) as typeof fetch;
    view.queryClient.clear();
    view.rerender(<SavedRecipeView />);

    await screen.findByText("First Soup");
    expect(screen.queryByRole("button", { name: "Share" })).toBeNull();
  });

  it("keeps a signed-out recipe in the public cache namespace", async () => {
    globalThis.fetch = vi.fn(async () =>
      Response.json(record("first-soup", "First Soup")),
    ) as typeof fetch;

    const { queryClient } = render(<SavedRecipeView />);

    expect(await screen.findByText("First Soup")).toBeInTheDocument();
    await clearOtherPrivateRecipeQueries(queryClient, null);

    expect(
      queryClient.getQueryData(recipeQueryKeys.publicSavedRecipe("first-soup")),
    ).toEqual(expect.objectContaining({ slug: "first-soup" }));
  });

  it("shows the cached route at its canonical recipe URL", async () => {
    globalThis.fetch = vi.fn(async () =>
      Response.json(record("first-soup", "First Soup")),
    ) as typeof fetch;
    navigation.pathname = "/recipes/saved";
    navigation.search = "slug=first-soup";
    const replaceState = vi.spyOn(window.history, "replaceState");

    render(<SavedRecipeView />);

    expect(await screen.findByText("First Soup")).toBeInTheDocument();
    expect(replaceState).toHaveBeenCalledWith(
      window.history.state,
      "",
      "/recipes/first-soup",
    );
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("does not redirect the saved-recipe route without a slug", async () => {
    globalThis.fetch = vi.fn();
    navigation.pathname = "/recipes/saved";

    render(<SavedRecipeView />);

    expect(
      await screen.findByText("No saved recipe was selected."),
    ).toBeInTheDocument();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
