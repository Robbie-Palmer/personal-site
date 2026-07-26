import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: {
    data: { user: { id: "user-1" } },
    isPending: false,
  },
  visibleRecipeCount: 7,
  catalogStats: {
    cuisineCount: 2,
    ingredientCount: 18,
    equipmentCount: 6,
  },
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => mocks.session },
}));

vi.mock("@/components/recipes/add-recipe-button", () => ({
  AddRecipeButton: () => null,
}));

vi.mock("@/components/recipes/recipe-collection", () => ({
  RecipeCollection: ({
    onCatalogStatsChange,
    onDietVisibleCountChange,
  }: {
    onCatalogStatsChange?: (stats: {
      cuisineCount: number;
      ingredientCount: number;
      equipmentCount: number;
    }) => void;
    onDietVisibleCountChange?: (count: number) => void;
  }) => (
    <button
      type="button"
      onClick={() => {
        onDietVisibleCountChange?.(mocks.visibleRecipeCount);
        onCatalogStatsChange?.(mocks.catalogStats);
      }}
    >
      Report visible recipes
    </button>
  ),
}));

import { RecipeBoxView } from "@/components/recipes/recipe-box-view";

describe("RecipeBoxView", () => {
  beforeEach(() => {
    mocks.session = {
      data: { user: { id: "user-1" } },
      isPending: false,
    };
    mocks.visibleRecipeCount = 7;
    mocks.catalogStats = {
      cuisineCount: 2,
      ingredientCount: 18,
      equipmentCount: 6,
    };
  });

  it("hides the previous user's count as soon as the account changes", async () => {
    const user = userEvent.setup();
    const view = render(<RecipeBoxView />);

    await user.click(
      screen.getByRole("button", { name: "Report visible recipes" }),
    );
    expect(screen.getByText("7 recipes")).toBeInTheDocument();
    expect(screen.getByText("2 cuisines")).toBeInTheDocument();
    expect(screen.getByText("18 ingredients")).toBeInTheDocument();
    expect(screen.getByText("6 tools")).toBeInTheDocument();

    mocks.session = {
      data: { user: { id: "user-2" } },
      isPending: false,
    };
    view.rerender(<RecipeBoxView />);

    expect(screen.queryByText("7 recipes")).not.toBeInTheDocument();
    expect(screen.queryByText("2 cuisines")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Loading recipe stats")).toBeInTheDocument();
  });

  it("hides a zero cuisine count while showing populated stats", async () => {
    const user = userEvent.setup();
    mocks.catalogStats = {
      cuisineCount: 0,
      ingredientCount: 18,
      equipmentCount: 6,
    };

    render(<RecipeBoxView />);
    await user.click(
      screen.getByRole("button", { name: "Report visible recipes" }),
    );

    expect(screen.queryByText("0 cuisines")).not.toBeInTheDocument();
    expect(screen.getByText("18 ingredients")).toBeInTheDocument();
    expect(screen.getByText("6 tools")).toBeInTheDocument();
  });

  it("shows only the recipe count when every catalog stat is zero", async () => {
    const user = userEvent.setup();
    mocks.visibleRecipeCount = 0;
    mocks.catalogStats = {
      cuisineCount: 0,
      ingredientCount: 0,
      equipmentCount: 0,
    };

    render(<RecipeBoxView />);
    await user.click(
      screen.getByRole("button", { name: "Report visible recipes" }),
    );

    expect(screen.getByText("0 recipes")).toBeInTheDocument();
    expect(screen.queryByText("0 cuisines")).not.toBeInTheDocument();
    expect(screen.queryByText("0 ingredients")).not.toBeInTheDocument();
    expect(screen.queryByText("0 tools")).not.toBeInTheDocument();
  });
});
