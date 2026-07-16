import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getHouseholds: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: mocks.useSession },
}));

vi.mock("@/lib/api/households", () => ({
  getHouseholds: mocks.getHouseholds,
}));

vi.mock("@/hooks/use-cooklang-recipe", () => ({
  useCooklangRecipe: () => ({ recipe: null, loading: false, error: null }),
}));

import { AddRecipeView } from "@/components/recipes/add-recipe-view";

const household = {
  id: "household-1",
  name: "Park Road kitchen",
  slug: "park-road",
  logo: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  membership: { id: "member-1", role: "owner" },
};

describe("AddRecipeView visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useSession.mockReturnValue({
      data: { user: { id: "user-1", name: "Robbie" } },
      isPending: false,
    });
  });

  it("defaults to household sharing when membership is available", async () => {
    mocks.getHouseholds.mockResolvedValue([household]);

    render(<AddRecipeView />);

    expect(
      await screen.findByRole("button", { name: "Household", pressed: true }),
    ).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Public" }));
    expect(
      screen.getByRole("button", { name: "Public", pressed: true }),
    ).toBeInTheDocument();
  });

  it("falls back to private when the user has no household", async () => {
    mocks.getHouseholds.mockResolvedValue([]);

    render(<AddRecipeView />);

    expect(
      await screen.findByRole("button", { name: "Private", pressed: true }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Household" })).toBeDisabled();
  });
});
