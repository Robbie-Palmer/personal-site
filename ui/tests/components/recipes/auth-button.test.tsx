import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useSession: vi.fn(),
  signInSocial: vi.fn(),
  signOut: vi.fn(),
  listAccounts: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: mocks.useSession,
    signIn: { social: mocks.signInSocial },
    signOut: mocks.signOut,
    listAccounts: mocks.listAccounts,
  },
}));

import { AuthButton } from "@/components/recipes/auth-button";

describe("AuthButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useSession.mockReturnValue({ data: null, isPending: false });
    mocks.signInSocial.mockResolvedValue({ data: null, error: null });
    mocks.signOut.mockResolvedValue({ data: null, error: null });
    mocks.listAccounts.mockResolvedValue({ data: [], error: null });
  });

  it("lets the user choose Google or GitHub", async () => {
    const user = userEvent.setup();
    render(<AuthButton />);

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(
      screen.getByRole("button", { name: "Continue with Google" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continue with GitHub" }),
    ).toBeInTheDocument();
  });

  it("starts the selected provider flow and preserves the current page", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/recipes/pasta?servings=4#method");
    render(<AuthButton />);

    await user.click(screen.getByRole("button", { name: /sign in/i }));
    await user.click(
      screen.getByRole("button", { name: "Continue with GitHub" }),
    );

    expect(mocks.signInSocial).toHaveBeenCalledWith({
      provider: "github",
      callbackURL: "/recipes/pasta?servings=4#method",
      errorCallbackURL: "/recipes/pasta?servings=4#method",
    });
  });

  it("shows the signed-in user and supports sign out", async () => {
    const user = userEvent.setup();
    mocks.useSession.mockReturnValue({
      data: { user: { name: "Robbie", email: "robbie@example.com" } },
      isPending: false,
    });
    mocks.listAccounts.mockResolvedValue({
      data: [
        {
          providerId: "github",
          accountId: "123456789",
        },
      ],
      error: null,
    });
    render(<AuthButton />);

    expect(screen.getByText("Robbie")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Account for Robbie" }),
    );

    expect(await screen.findByText("Connected identities")).toBeInTheDocument();
    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(
      screen.getByText("Provider account ending 456789"),
    ).toBeInTheDocument();
    expect(mocks.listAccounts).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(mocks.signOut).toHaveBeenCalledOnce();
  });

  it("shows an error when sign out fails", async () => {
    const user = userEvent.setup();
    mocks.useSession.mockReturnValue({
      data: { user: { name: "Robbie", email: "robbie@example.com" } },
      isPending: false,
    });
    mocks.signOut.mockResolvedValue({
      data: null,
      error: { message: "Session could not be ended" },
    });
    render(<AuthButton />);

    await user.click(
      screen.getByRole("button", { name: "Account for Robbie" }),
    );
    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Session could not be ended",
    );
  });
});
