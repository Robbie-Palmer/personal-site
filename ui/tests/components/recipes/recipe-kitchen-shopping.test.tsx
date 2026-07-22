import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildKitchenCatalog: vi.fn(),
  fetchRecipeBoxRecipes: vi.fn(),
  recipeRecordsToShoppingRecipes: vi.fn(),
}));

vi.mock("@/lib/api/saved-recipes", () => ({
  fetchRecipeBoxRecipes: mocks.fetchRecipeBoxRecipes,
}));

vi.mock("@/lib/api/recipes", () => ({
  buildKitchenCatalog: mocks.buildKitchenCatalog,
}));

vi.mock("@/lib/api/shopping", () => ({
  recipeRecordsToShoppingRecipes: mocks.recipeRecordsToShoppingRecipes,
}));

vi.mock("@/components/recipes/kitchen/kitchen-view", () => ({
  KitchenView: () => <div>Loaded kitchen</div>,
}));

vi.mock("@/components/recipes/shopping/shopping-view", () => ({
  ShoppingView: () => <div>Loaded shopping list</div>,
}));

import { RecipeKitchen } from "@/components/recipes/kitchen/recipe-kitchen";
import { RecipeShopping } from "@/components/recipes/shopping/recipe-shopping";

describe("database-backed kitchen and shopping pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildKitchenCatalog.mockReturnValue({
      recipes: [],
      initialStock: [],
      pantry: [],
    });
    mocks.recipeRecordsToShoppingRecipes.mockReturnValue([]);
  });

  it("loads recipe-box recipes into the kitchen and aborts on unmount", async () => {
    const recipes = [{ slug: "lentil-soup" }];
    let signal: AbortSignal | undefined;
    mocks.fetchRecipeBoxRecipes.mockImplementation(async (requestSignal) => {
      signal = requestSignal;
      return { recipes, box: { completed: true, recipeSlugs: [] } };
    });

    const view = render(<RecipeKitchen />);
    expect(await screen.findByText("Loaded kitchen")).toBeInTheDocument();
    expect(mocks.buildKitchenCatalog).toHaveBeenCalledWith(recipes);

    view.unmount();
    expect(signal?.aborted).toBe(true);
  });

  it("shows a kitchen load error while ignoring abort errors", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mocks.fetchRecipeBoxRecipes.mockRejectedValueOnce(new Error("offline"));
    const failedView = render(<RecipeKitchen />);
    expect(
      await screen.findByText("Your kitchen could not be loaded."),
    ).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();
    failedView.unmount();

    mocks.fetchRecipeBoxRecipes.mockRejectedValueOnce(
      new DOMException("aborted", "AbortError"),
    );
    render(<RecipeKitchen />);
    await act(async () => {});
    expect(
      screen.queryByText("Your kitchen could not be loaded."),
    ).not.toBeInTheDocument();
  });

  it("loads recipe-box recipes into the shopping view", async () => {
    const records = [{ slug: "lentil-soup" }];
    const shoppingRecipes = [{ slug: "lentil-soup", title: "Lentil Soup" }];
    mocks.fetchRecipeBoxRecipes.mockResolvedValue({
      recipes: records,
      box: { completed: true, recipeSlugs: [] },
    });
    mocks.recipeRecordsToShoppingRecipes.mockReturnValue(shoppingRecipes);

    render(<RecipeShopping />);

    expect(await screen.findByText("Loaded shopping list")).toBeInTheDocument();
    expect(mocks.recipeRecordsToShoppingRecipes).toHaveBeenCalledWith(records);
  });

  it("shows a shopping load error while ignoring abort errors", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mocks.fetchRecipeBoxRecipes.mockRejectedValueOnce(new Error("offline"));
    const failedView = render(<RecipeShopping />);
    expect(
      await screen.findByText("Your recipes could not be loaded."),
    ).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();
    failedView.unmount();

    mocks.fetchRecipeBoxRecipes.mockRejectedValueOnce(
      new DOMException("aborted", "AbortError"),
    );
    render(<RecipeShopping />);
    await act(async () => {});
    expect(
      screen.queryByText("Your recipes could not be loaded."),
    ).not.toBeInTheDocument();
  });
});
