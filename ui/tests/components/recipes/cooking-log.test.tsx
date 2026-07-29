import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CookingLog } from "@/components/recipes/cooking-log";

const mocks = vi.hoisted(() => ({
  getCookingInsights: vi.fn(),
  session: { user: { id: "cook-1" } } as { user: { id: string } } | null,
  sessionPending: false,
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: mocks.session,
      isPending: mocks.sessionPending,
    }),
  },
}));

vi.mock("@/lib/api/cooking-insights", () => ({
  getCookingInsights: mocks.getCookingInsights,
}));

describe("CookingLog", () => {
  beforeEach(() => {
    mocks.getCookingInsights.mockReset();
    mocks.session = { user: { id: "cook-1" } };
    mocks.sessionPending = false;
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

  it("shows pending, signed-out, and load-error states", async () => {
    mocks.sessionPending = true;
    const { rerender } = render(<CookingLog />);
    expect(screen.getByText("Opening your cook log…")).toBeInTheDocument();

    mocks.sessionPending = false;
    mocks.session = null;
    rerender(<CookingLog />);
    expect(
      screen.getByText("Log in to remember what you cooked."),
    ).toBeInTheDocument();

    mocks.session = { user: { id: "cook-1" } };
    mocks.getCookingInsights.mockRejectedValue(
      new Error("Cook log unavailable"),
    );
    rerender(<CookingLog />);
    expect(await screen.findByText("Cook log unavailable")).toBeInTheDocument();
  });
});
