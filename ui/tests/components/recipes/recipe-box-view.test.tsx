import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: {
    data: { user: { id: "user-1" } },
    isPending: false,
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
        onDietVisibleCountChange?.(7);
        onCatalogStatsChange?.({
          cuisineCount: 2,
          ingredientCount: 18,
          equipmentCount: 6,
        });
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
});
