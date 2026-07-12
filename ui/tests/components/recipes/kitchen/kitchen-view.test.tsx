import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KitchenView } from "@/components/recipes/kitchen/kitchen-view";

const dietState = vi.hoisted(() => ({ mode: "hide" as "hide" | "warn" }));

vi.mock("@/components/recipes/diet-provider", () => ({
  useDiet: () => ({
    diet: {
      active: true,
      labels: ["Vegan"],
      mode: dietState.mode,
      excludedIngredientSlugs: new Set(["bacon"]),
      ingredientNames: new Map([["bacon", "Bacon"]]),
    },
    loading: false,
    matchRecipe: () => ({ matches: true, excludedIngredients: [] }),
  }),
}));

vi.mock("@/hooks/use-kitchen-stock", () => ({
  useKitchenStock: () => ({}),
}));

vi.mock("@/hooks/use-shopping-list", () => ({
  useShoppingList: () => ({ recipes: [] }),
}));

vi.mock("@/lib/kitchen/kitchenStockStore", () => ({
  clearStock: vi.fn(),
  removeFromStock: vi.fn(),
  replaceStock: vi.fn(),
  setStockLocation: vi.fn(),
}));

vi.mock("@/lib/shopping/shoppingListStore", () => ({
  toggleRecipe: vi.fn(),
}));

const ingredients = [
  { slug: "bacon", name: "Bacon", category: "protein" as const },
  { slug: "chickpeas", name: "Chickpeas", category: "legume" as const },
];

describe("KitchenView diet ingredient catalog", () => {
  beforeEach(() => {
    dietState.mode = "hide";
  });

  it("hides excluded ingredients and supports a temporary override", async () => {
    const user = userEvent.setup();
    render(<KitchenView ingredients={ingredients} recipes={[]} />);

    expect(screen.queryByRole("button", { name: /add bacon/i })).toBeNull();
    expect(
      screen.getByRole("button", { name: /add chickpeas/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show anyway" }));

    expect(
      screen.getByRole("button", { name: /add bacon — diet warning/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Diet warning")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Hide diet exclusions" }),
    ).toBeInTheDocument();
  });

  it("shows excluded ingredients with warnings in warn mode", () => {
    dietState.mode = "warn";
    render(<KitchenView ingredients={ingredients} recipes={[]} />);

    expect(
      screen.getByRole("button", { name: /add bacon — diet warning/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show anyway" })).toBeNull();
  });
});
