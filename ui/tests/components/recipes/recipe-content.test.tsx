import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RecipeDetailView } from "@/lib/domain/recipe/recipeViews";

const mocks = vi.hoisted(() => ({
  tokenizeInstructionSdk: vi.fn(),
}));

vi.mock("@/components/recipes/diet-provider", () => ({
  useDiet: () => ({
    diet: { active: false },
    matchRecipe: () => ({ matches: true, excludedIngredients: [] }),
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
  useUnitPreference: () => ["metric", vi.fn()],
}));

vi.mock("@/lib/domain/recipe/instructionTokens", () => ({
  tokenizeInstructionSdk: mocks.tokenizeInstructionSdk,
}));

import { RecipeContent } from "@/components/recipes/recipe-content";

const recipe: RecipeDetailView = {
  slug: "weeknight",
  title: "Weeknight pasta",
  description: "A quick test recipe.",
  date: "2026-07-14",
  cuisine: [],
  tags: [],
  servings: 2,
  cookBody: "Cook for ~{10%minutes}.",
  cookware: [],
  ingredientGroups: [],
  instructions: ["Cook for 10 minutes."],
  instructionSdk: {} as NonNullable<RecipeDetailView["instructionSdk"]>,
};

describe("RecipeContent", () => {
  beforeEach(() => {
    mocks.tokenizeInstructionSdk.mockReturnValue({
      ok: true,
      steps: [
        [
          { type: "text", value: "Cook for " },
          { type: "timer", value: "10 minutes", durationSeconds: 600 },
          { type: "text", value: "." },
        ],
      ],
    });
  });

  it("renders timers as disabled in an unsaved recipe preview", () => {
    render(<RecipeContent recipe={recipe} timersEnabled={false} />);

    expect(screen.getByRole("button", { name: "10 minutes" })).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: /start 10 minutes timer/i }),
    ).not.toBeInTheDocument();
  });
});
