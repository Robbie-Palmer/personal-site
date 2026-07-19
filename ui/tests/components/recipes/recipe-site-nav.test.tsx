import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/recipes",
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: mocks.useSession },
}));

vi.mock("@/components/recipes/recipe-nav-tabs", () => ({
  RecipeNavTabs: () => <div>Personal recipe tabs</div>,
}));

import { RecipeSiteNav } from "@/components/recipes/recipe-site-nav";

describe("RecipeSiteNav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders neutral navigation while the session is loading", () => {
    mocks.useSession.mockReturnValue({ data: null, isPending: true });

    render(<RecipeSiteNav />);

    expect(
      screen.getByRole("status", { name: "Loading recipe navigation" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Discover" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Personal recipe tabs")).not.toBeInTheDocument();
  });

  it("renders personal navigation for signed-in users", () => {
    mocks.useSession.mockReturnValue({
      data: { user: { id: "user-1" } },
      isPending: false,
    });

    render(<RecipeSiteNav />);

    expect(screen.getByText("Personal recipe tabs")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Discover" }),
    ).not.toBeInTheDocument();
  });
});
