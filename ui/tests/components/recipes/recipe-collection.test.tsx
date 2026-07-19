import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: { data: { user: { id: "user-1" } }, isPending: false },
  dietLoading: false,
  fetchSaved: vi.fn(),
  fetchBox: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => mocks.session },
}));

vi.mock("@/components/recipes/diet-provider", () => ({
  useDiet: () => ({ loading: mocks.dietLoading }),
}));

vi.mock("@/lib/api/saved-recipes", () => ({
  fetchAllSavedRecipes: mocks.fetchSaved,
}));

vi.mock("@/lib/api/recipe-box", () => ({
  getRecipeBoxProfile: mocks.fetchBox,
}));

vi.mock("@/lib/domain/recipe/recipeDraft", () => ({
  savedRecipeCard: (record: { slug: string; title: string }) => ({
    ...record,
    description: "Saved recipe",
    date: "2026-07-19",
    cuisine: [],
    tags: [],
    servings: 2,
    ingredientNames: [],
    ingredientSlugs: [],
    cookware: [],
  }),
}));

vi.mock("@/components/ui/card-grid-skeleton", () => ({
  CardGridSkeleton: () => <div>Loading personalized recipes</div>,
}));

vi.mock("@/components/recipes/recipe-list", () => ({
  RecipeList: ({ recipes }: { recipes: { title: string }[] }) => (
    <div>Recipes: {recipes.map((recipe) => recipe.title).join(", ")}</div>
  ),
}));

import { RecipeCollection } from "@/components/recipes/recipe-collection";
import type { RecipeCardView } from "@/lib/api/recipes";

const staticRecipes = [
  { slug: "starter", title: "Selected starter" },
  { slug: "not-selected", title: "Default catalogue recipe" },
] as RecipeCardView[];

describe("RecipeCollection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session = {
      data: { user: { id: "user-1" } },
      isPending: false,
    };
    mocks.dietLoading = false;
  });

  it("keeps default recipes hidden until personalization is ready", async () => {
    let resolveSaved!: (value: { slug: string; title: string }[]) => void;
    let resolveBox!: (value: {
      completed: boolean;
      staticRecipeSlugs: string[];
    }) => void;
    mocks.fetchSaved.mockReturnValue(
      new Promise((resolve) => {
        resolveSaved = resolve;
      }),
    );
    mocks.fetchBox.mockReturnValue(
      new Promise((resolve) => {
        resolveBox = resolve;
      }),
    );

    render(<RecipeCollection recipes={staticRecipes} />);

    expect(
      screen.getByText("Loading personalized recipes"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Default catalogue recipe/),
    ).not.toBeInTheDocument();

    resolveSaved([{ slug: "saved", title: "My saved recipe" }]);
    resolveBox({ completed: true, staticRecipeSlugs: ["starter"] });

    expect(
      await screen.findByText("Recipes: My saved recipe, Selected starter"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Default catalogue recipe/),
    ).not.toBeInTheDocument();
  });

  it("does not expose one user's recipes while another user loads", async () => {
    mocks.fetchSaved.mockResolvedValueOnce([
      { slug: "first", title: "First user's recipe" },
    ]);
    mocks.fetchBox.mockResolvedValueOnce({
      completed: true,
      staticRecipeSlugs: [],
    });

    const view = render(<RecipeCollection recipes={staticRecipes} />);
    expect(
      await screen.findByText("Recipes: First user's recipe"),
    ).toBeInTheDocument();

    mocks.session = {
      data: { user: { id: "user-2" } },
      isPending: false,
    };
    mocks.fetchSaved.mockReturnValueOnce(new Promise(() => undefined));
    mocks.fetchBox.mockReturnValueOnce(new Promise(() => undefined));
    view.rerender(<RecipeCollection recipes={staticRecipes} />);

    await waitFor(() =>
      expect(
        screen.getByText("Loading personalized recipes"),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText(/First user's recipe/)).not.toBeInTheDocument();
  });

  it("waits for diet preferences before rendering the recipe list", async () => {
    mocks.dietLoading = true;
    mocks.fetchSaved.mockResolvedValue([]);
    mocks.fetchBox.mockResolvedValue({
      completed: true,
      staticRecipeSlugs: ["starter"],
    });

    const view = render(<RecipeCollection recipes={staticRecipes} />);
    expect(
      screen.getByText("Loading personalized recipes"),
    ).toBeInTheDocument();

    mocks.dietLoading = false;
    view.rerender(<RecipeCollection recipes={staticRecipes} />);

    expect(
      await screen.findByText("Recipes: Selected starter"),
    ).toBeInTheDocument();
  });
});
