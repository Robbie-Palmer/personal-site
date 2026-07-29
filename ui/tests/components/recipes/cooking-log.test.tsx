import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CookingLog } from "@/components/recipes/cooking-log";

const mocks = vi.hoisted(() => ({
  getCookingInsights: vi.fn(),
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
  getCookingInsights: mocks.getCookingInsights,
}));

describe("CookingLog", () => {
  beforeEach(() => {
    mocks.getCookingInsights.mockReset();
    mocks.getCookingInsights.mockResolvedValue({
      cookModeStarts: 9,
      mealsCooked: 6,
      distinctRecipesCooked: 4,
      recent: [
        {
          id: "2f64837b-3f3e-4c18-ae39-35df6808dc6c",
          recipeSlug: "weeknight-pasta",
          recipeTitle: "Weeknight pasta",
          servings: 3,
          startedAt: "2026-07-28T17:30:00.000Z",
          completedAt: "2026-07-28T18:05:00.000Z",
        },
      ],
    });
  });

  it("shows completed meal totals separately from cook-mode starts", async () => {
    render(<CookingLog />);

    expect(await screen.findByText("Weeknight pasta")).toBeInTheDocument();
    expect(
      screen.getByText("Meals cooked").nextElementSibling,
    ).toHaveTextContent("6");
    expect(
      screen.getByText("Different dishes").nextElementSibling,
    ).toHaveTextContent("4");
    expect(
      screen.getByText("Cook-mode starts").nextElementSibling,
    ).toHaveTextContent("9");
    expect(screen.getByText("Served 3")).toBeInTheDocument();
  });
});
