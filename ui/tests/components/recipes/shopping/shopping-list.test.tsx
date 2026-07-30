import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShoppingList } from "@/components/recipes/shopping/shopping-list";
import type { ShoppingRecipe } from "@/lib/api/shopping";
import {
  __resetShoppingListForTests,
  addRecipe,
  toggleChecked,
} from "@/lib/shopping/shoppingListStore";

const mocks = vi.hoisted(() => ({
  captureRecipeProductActivity: vi.fn(),
  captureRecipeValue: vi.fn(),
}));

vi.mock("@/lib/analytics/recipe-product", () => ({
  captureRecipeProductActivity: mocks.captureRecipeProductActivity,
  captureRecipeValue: mocks.captureRecipeValue,
}));

vi.mock("@/hooks/use-kitchen-stock", () => ({
  useKitchenStock: () => ({}),
}));

vi.mock("@/hooks/use-unit-preference", async () => {
  const { preferenceForSystem } = await vi.importActual<
    typeof import("@/lib/domain/recipe/unit")
  >("@/lib/domain/recipe/unit");
  return {
    useUnitPreference: () => [preferenceForSystem("uk"), vi.fn()],
  };
});

const recipes: ShoppingRecipe[] = [
  {
    slug: "garlic-pasta",
    title: "Garlic pasta",
    servings: 2,
    cuisine: [],
    ingredients: [
      {
        ingredient:
          "garlic" as ShoppingRecipe["ingredients"][number]["ingredient"],
        name: "garlic",
        amount: 1,
        unit: "clove",
      },
    ],
  },
];

describe("ShoppingList value analytics", () => {
  beforeEach(() => {
    localStorage.clear();
    __resetShoppingListForTests();
    addRecipe("garlic-pasta");
    mocks.captureRecipeProductActivity.mockClear();
    mocks.captureRecipeValue.mockClear();
  });

  afterEach(() => {
    __resetShoppingListForTests();
  });

  it("records an assisted shop when the final item is checked", async () => {
    const user = userEvent.setup();
    render(<ShoppingList recipes={recipes} />);

    expect(mocks.captureRecipeValue).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /garlic/i }));

    await waitFor(() =>
      expect(mocks.captureRecipeValue).toHaveBeenCalledWith(
        "shopping_trip_completed",
        {
          item_count: 1,
          recipe_count: 1,
        },
      ),
    );
  });

  it("does not re-record an already completed persisted shop on mount", () => {
    toggleChecked("garlic");
    mocks.captureRecipeValue.mockClear();

    render(<ShoppingList recipes={recipes} />);

    expect(mocks.captureRecipeValue).not.toHaveBeenCalled();
  });

  it("records one value event when the final item is unchecked and rechecked", async () => {
    const user = userEvent.setup();
    render(<ShoppingList recipes={recipes} />);
    const garlic = screen.getByRole("button", { name: /garlic/i });

    await user.click(garlic);
    await user.click(garlic);
    await user.click(garlic);

    expect(mocks.captureRecipeValue).toHaveBeenCalledTimes(1);
  });
});
