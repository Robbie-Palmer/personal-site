import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useSession: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: mocks.useSession },
}));

vi.mock("@/components/recipes/logged-out-landing", () => ({
  LoggedOutLanding: () => <div>Public landing</div>,
}));

vi.mock("@/components/recipes/recipe-box-view", () => ({
  RecipeBoxView: () => <div>Your recipe box</div>,
}));

import { RecipeHome } from "@/components/recipes/recipe-home";

describe("RecipeHome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the public landing page to logged-out visitors", () => {
    mocks.useSession.mockReturnValue({ data: null, isPending: false });

    render(<RecipeHome recipes={[]} catalogStats={[]} />);

    expect(screen.getByText("Public landing")).toBeInTheDocument();
    expect(screen.queryByText("Your recipe box")).not.toBeInTheDocument();
  });

  it("keeps the personal recipe box for signed-in users", () => {
    mocks.useSession.mockReturnValue({
      data: { user: { id: "user-1" } },
      isPending: false,
    });

    render(<RecipeHome recipes={[]} catalogStats={[]} />);

    expect(screen.getByText("Your recipe box")).toBeInTheDocument();
    expect(screen.queryByText("Public landing")).not.toBeInTheDocument();
  });

  it("renders the public landing while the session is loading", () => {
    mocks.useSession.mockReturnValue({ data: null, isPending: true });

    render(<RecipeHome recipes={[]} catalogStats={[]} />);

    expect(screen.getByText("Public landing")).toBeInTheDocument();
    expect(screen.queryByText("Your recipe box")).not.toBeInTheDocument();
  });
});
