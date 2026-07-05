import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useSession: vi.fn(),
  signInSocial: vi.fn(),
  signOut: vi.fn(),
  listAccounts: vi.fn(),
  getLastUsedLoginMethod: vi.fn(),
  isPreviewDeployment: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: mocks.useSession,
    signIn: { social: mocks.signInSocial },
    signOut: mocks.signOut,
    listAccounts: mocks.listAccounts,
    getLastUsedLoginMethod: mocks.getLastUsedLoginMethod,
  },
}));

vi.mock("@/lib/preview-environment", () => ({
  isPreviewDeployment: mocks.isPreviewDeployment,
}));

import { AuthButton } from "@/components/recipes/auth-button";

describe("AuthButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useSession.mockReturnValue({ data: null, isPending: false });
    mocks.signInSocial.mockResolvedValue({ data: null, error: null });
    mocks.signOut.mockResolvedValue({ data: null, error: null });
    mocks.listAccounts.mockResolvedValue({ data: [], error: null });
    mocks.getLastUsedLoginMethod.mockReturnValue(null);
    mocks.isPreviewDeployment.mockReturnValue(false);
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
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

  it("marks the last used provider", async () => {
    const user = userEvent.setup();
    mocks.getLastUsedLoginMethod.mockReturnValue("google");
    render(<AuthButton />);

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(
      screen.getByRole("button", { name: /Continue with Google/ }),
    ).toHaveTextContent("Last used");
    expect(
      screen.getByRole("button", { name: /Continue with GitHub/ }),
    ).not.toHaveTextContent("Last used");
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

  it("offers Access-protected test scenarios on PR previews", async () => {
    const user = userEvent.setup();
    mocks.isPreviewDeployment.mockReturnValue(true);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: "empty-user",
              name: "Empty account",
              description: "A standard user with no saved recipes.",
            },
          ]),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Preview sign-in failed" }),
      });
    vi.stubGlobal("fetch", fetchMock);
    render(<AuthButton />);

    await user.click(screen.getByRole("button", { name: /sign in/i }));
    const scenarioButton = await screen.findByRole("button", {
      name: /Empty account/,
    });
    expect(
      screen.queryByRole("button", { name: "Continue with Google" }),
    ).not.toBeInTheDocument();

    await user.click(scenarioButton);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        "/api/auth/preview/sign-in",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ scenario: "empty-user" }),
        }),
      ),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Preview sign-in failed",
    );
  });

  it("disables sign-in on a frontend-only preview", async () => {
    const user = userEvent.setup();
    mocks.isPreviewDeployment.mockReturnValue(true);
    vi.stubEnv("NEXT_PUBLIC_PREVIEW_BACKEND", "false");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<AuthButton />);

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sign-in is disabled on this frontend-only preview.",
    );
    expect(screen.getByText("Sign-in unavailable")).toBeInTheDocument();
    expect(
      screen.queryByText("Choose a preview scenario"),
    ).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("opens an account menu linking to settings and supports sign out", async () => {
    const user = userEvent.setup();
    mocks.useSession.mockReturnValue({
      data: { user: { name: "Robbie", email: "robbie@example.com" } },
      isPending: false,
    });
    render(<AuthButton />);

    await user.click(
      screen.getByRole("button", { name: "Account for Robbie" }),
    );

    expect(screen.getByText("robbie@example.com")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /settings/i })).toHaveAttribute(
      "href",
      "/recipes/settings",
    );

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
