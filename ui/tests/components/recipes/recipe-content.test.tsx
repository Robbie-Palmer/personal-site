import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RecipeDetailView } from "@/lib/domain/recipe/recipeViews";
import { preferenceForSystem } from "@/lib/domain/recipe/unit";

const mocks = vi.hoisted(() => ({
  setUnitPreference: vi.fn(),
}));

const customPreference = {
  ...preferenceForSystem("uk"),
  preset: "custom" as const,
};

vi.mock("@/components/recipes/diet-provider", () => ({
  useDiet: () => ({
    diet: { active: false },
    matchRecipe: () => ({ matches: [] }),
  }),
}));

vi.mock("@/hooks/use-scaled-recipe", () => ({
  useScaledRecipe: (recipe: RecipeDetailView) => ({
    view: recipe,
    scaleMultiplier: 1,
    isScaling: false,
    error: null,
  }),
}));

vi.mock("@/hooks/use-unit-preference", () => ({
  useUnitPreference: () => [customPreference, mocks.setUnitPreference],
}));

import { RecipeContent } from "@/components/recipes/recipe-content";

const recipe: RecipeDetailView = {
  slug: "unit-test-recipe",
  title: "Unit test recipe",
  description: "A recipe used to test local unit overrides.",
  date: "2026-07-14",
  cuisine: [],
  tags: [],
  servings: 2,
  cookBody: "",
  cookware: [],
  ingredientGroups: [],
  instructions: [],
};

describe("RecipeContent", () => {
  beforeEach(() => {
    mocks.setUnitPreference.mockClear();
  });

  it("previews a preset without overwriting the saved custom ladder", async () => {
    const user = userEvent.setup();
    render(<RecipeContent recipe={recipe} />);

    expect(screen.getByRole("button", { name: "Custom" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(screen.getByRole("button", { name: "Metric" }));

    expect(screen.getByRole("button", { name: "Metric" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(mocks.setUnitPreference).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Custom" }));
    expect(screen.getByRole("button", { name: "Custom" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
