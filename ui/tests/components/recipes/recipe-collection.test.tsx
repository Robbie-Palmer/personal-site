import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: { data: { user: { id: "user-1" } }, isPending: false },
  dietLoading: false,
  fetchRecipeBoxRecipes: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => mocks.session },
}));

vi.mock("@/components/recipes/diet-provider", () => ({
  useDiet: () => ({ loading: mocks.dietLoading }),
}));

vi.mock("@/lib/api/saved-recipes", () => ({
  fetchRecipeBoxRecipes: mocks.fetchRecipeBoxRecipes,
}));

vi.mock("@/lib/domain/recipe/recipeDraft", () => ({
  savedRecipeCard: (record: {
    slug: string;
    title: string;
    cuisine?: string[];
    ingredientNames?: string[];
    ingredientSlugs?: string[];
    cookware?: string[];
  }) => ({
    ...record,
    description: "Saved recipe",
    date: "2026-07-19",
    cuisine: record.cuisine ?? [],
    tags: [],
    servings: 2,
    ingredientNames: record.ingredientNames ?? [],
    ingredientSlugs: record.ingredientSlugs ?? [],
    cookware: record.cookware ?? [],
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

describe("RecipeCollection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session = {
      data: { user: { id: "user-1" } },
      isPending: false,
    };
    mocks.dietLoading = false;
  });

  it("keeps recipes hidden until personalization is ready", async () => {
    let resolveBox!: (value: {
      recipes: { slug: string; title: string }[];
      box: { completed: boolean; recipeSlugs: string[] };
    }) => void;
    mocks.fetchRecipeBoxRecipes.mockReturnValue(
      new Promise((resolve) => {
        resolveBox = resolve;
      }),
    );

    render(<RecipeCollection />);
    expect(
      screen.getByText("Loading personalized recipes"),
    ).toBeInTheDocument();

    resolveBox({
      recipes: [
        { slug: "saved", title: "My saved recipe" },
        { slug: "starter", title: "Selected starter" },
      ],
      box: { completed: true, recipeSlugs: ["starter"] },
    });

    expect(
      await screen.findByText("Recipes: My saved recipe, Selected starter"),
    ).toBeInTheDocument();
  });

  it("does not expose one user's recipes while another user loads", async () => {
    mocks.fetchRecipeBoxRecipes.mockResolvedValueOnce({
      recipes: [{ slug: "first", title: "First user's recipe" }],
      box: { completed: true, recipeSlugs: [] },
    });

    const view = render(<RecipeCollection />);
    expect(
      await screen.findByText("Recipes: First user's recipe"),
    ).toBeInTheDocument();

    mocks.session = {
      data: { user: { id: "user-2" } },
      isPending: false,
    };
    mocks.fetchRecipeBoxRecipes.mockReturnValueOnce(
      new Promise(() => undefined),
    );
    view.rerender(<RecipeCollection />);

    expect(
      await screen.findByText("Loading personalized recipes"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/First user's recipe/)).not.toBeInTheDocument();
  });

  it("waits for diet preferences before rendering the recipe list", async () => {
    mocks.dietLoading = true;
    mocks.fetchRecipeBoxRecipes.mockResolvedValue({
      recipes: [{ slug: "starter", title: "Selected starter" }],
      box: { completed: true, recipeSlugs: ["starter"] },
    });

    const view = render(<RecipeCollection />);
    expect(
      screen.getByText("Loading personalized recipes"),
    ).toBeInTheDocument();

    mocks.dietLoading = false;
    view.rerender(<RecipeCollection />);

    expect(
      await screen.findByText("Recipes: Selected starter"),
    ).toBeInTheDocument();
  });

  it("reports unique catalog stats from the loaded recipe box", async () => {
    const onCatalogStatsChange = vi.fn();
    mocks.fetchRecipeBoxRecipes.mockResolvedValue({
      recipes: [
        {
          slug: "pasta",
          title: "Pasta",
          cuisine: ["Italian"],
          ingredientNames: ["tomato", "pasta"],
          cookware: ["pot", "spoon"],
        },
        {
          slug: "soup",
          title: "Soup",
          cuisine: ["Italian", "French"],
          ingredientNames: ["tomato", "stock"],
          cookware: ["pot", "ladle"],
        },
      ],
      box: { completed: true, recipeSlugs: [] },
    });

    render(<RecipeCollection onCatalogStatsChange={onCatalogStatsChange} />);

    await screen.findByText("Recipes: Pasta, Soup");
    expect(onCatalogStatsChange).toHaveBeenCalledWith({
      cuisineCount: 2,
      ingredientCount: 3,
      equipmentCount: 3,
    });
  });
});
