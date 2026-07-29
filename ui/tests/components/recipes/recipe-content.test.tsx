import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecipeContent } from "@/components/recipes/recipe-content";
import { CookModeProvider } from "@/contexts/cook-mode-context";
import type { RecipeDetailView } from "@/lib/domain/recipe/recipeViews";
import { preferenceForSystem } from "@/lib/domain/recipe/unit";

const mocks = vi.hoisted(() => ({
  setUnitPreference: vi.fn(),
  tokenizeInstructionSdk: vi.fn(),
  recordCookingSession: vi.fn().mockResolvedValue({}),
}));

const customPreference = {
  ...preferenceForSystem("uk"),
  preset: "custom" as const,
};

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
  useUnitPreference: () => [customPreference, mocks.setUnitPreference],
}));

vi.mock("@/lib/domain/recipe/instructionTokens", () => ({
  tokenizeInstructionSdk: mocks.tokenizeInstructionSdk,
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: { user: { id: "cook-1" } },
      isPending: false,
    }),
  },
}));

vi.mock("@/lib/api/cooking-insights", () => ({
  recordCookingSession: mocks.recordCookingSession,
}));

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
    mocks.setUnitPreference.mockClear();
    mocks.recordCookingSession.mockClear();
    window.history.replaceState(null, "", "/recipes/saved?slug=weeknight");
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

  it("renders timers as disabled in an unsaved recipe preview", () => {
    render(<RecipeContent recipe={recipe} timersEnabled={false} />);

    expect(screen.getByRole("button", { name: "10 minutes" })).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: /start 10 minutes timer/i }),
    ).not.toBeInTheDocument();
  });

  it("retains native list markers for Safari accessibility", () => {
    const { container } = render(<RecipeContent recipe={recipe} />);

    const method = container.querySelector(".rt-method-steps");
    expect(method).toHaveClass("list-decimal", "marker:text-transparent");
    expect(method).not.toHaveClass("list-none");
  });

  it("tracks a cook-mode start but only counts the meal when Finish is clicked", async () => {
    const user = userEvent.setup();
    render(
      <CookModeProvider>
        <RecipeContent recipe={recipe} />
      </CookModeProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Start cooking" }));
    await waitFor(() =>
      expect(mocks.recordCookingSession).toHaveBeenCalledWith(
        expect.objectContaining({
          recipeSlug: "weeknight",
          servings: 2,
          event: "started",
        }),
      ),
    );

    const started = mocks.recordCookingSession.mock.calls[0]?.[0];
    await user.click(screen.getByRole("button", { name: "Finish ✓" }));

    expect(mocks.recordCookingSession).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sessionId: started.sessionId,
        event: "completed",
      }),
    );
  });
});
