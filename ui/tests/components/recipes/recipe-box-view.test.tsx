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
    onDietVisibleCountChange,
  }: {
    onDietVisibleCountChange?: (count: number) => void;
  }) => (
    <button type="button" onClick={() => onDietVisibleCountChange?.(7)}>
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

    mocks.session = {
      data: { user: { id: "user-2" } },
      isPending: false,
    };
    view.rerender(<RecipeBoxView />);

    expect(screen.queryByText("7 recipes")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Loading recipe count")).toBeInTheDocument();
  });
});
