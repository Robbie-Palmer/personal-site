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

const pantryState = vi.hoisted(() => ({
  error: null as Error | null,
  isPending: false,
}));

vi.mock("@/lib/analytics/recipe-product", () => ({
  captureRecipeProductActivity: mocks.captureRecipeProductActivity,
  captureRecipeValue: mocks.captureRecipeValue,
}));

vi.mock("@/hooks/use-kitchen-stock", () => ({
  useKitchenStockActions: () => ({
    error: null,
    isPending: false,
    removeFromStock: vi.fn(),
  }),
  useKitchenStockQuery: () => ({
    data: { scope: { type: "personal" }, stock: {} },
    error: pantryState.error,
    isPending: pantryState.isPending,
  }),
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
    pantryState.error = null;
    pantryState.isPending = false;
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

describe("ShoppingList pantry state", () => {
  beforeEach(() => {
    pantryState.error = null;
    pantryState.isPending = false;
    localStorage.clear();
    __resetShoppingListForTests();
    addRecipe("garlic-pasta");
  });

  afterEach(() => {
    __resetShoppingListForTests();
  });

  it("waits for pantry stock before classifying shopping items", () => {
    pantryState.isPending = true;

    render(<ShoppingList recipes={recipes} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading your pantry before building the shopping list…",
    );
    expect(screen.queryByRole("button", { name: /garlic/i })).toBeNull();
  });

  it("does not classify shopping items when pantry loading fails", () => {
    pantryState.error = new Error("load failed");

    render(<ShoppingList recipes={recipes} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Your pantry could not be loaded.",
    );
    expect(screen.queryByRole("button", { name: /garlic/i })).toBeNull();
  });
});
