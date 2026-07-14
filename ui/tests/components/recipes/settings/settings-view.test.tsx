import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useSession: vi.fn(),
  updateUser: vi.fn(),
  listAccounts: vi.fn(),
  listSessions: vi.fn(),
  linkSocial: vi.fn(),
  unlinkAccount: vi.fn(),
  revokeSession: vi.fn(),
  getHouseholds: vi.fn(),
  createHousehold: vi.fn(),
  getHouseholdMembers: vi.fn(),
  getHouseholdInvitations: vi.fn(),
  getIncomingHouseholdInvitations: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: mocks.useSession,
    updateUser: mocks.updateUser,
    listAccounts: mocks.listAccounts,
    listSessions: mocks.listSessions,
    linkSocial: mocks.linkSocial,
    unlinkAccount: mocks.unlinkAccount,
    revokeSession: mocks.revokeSession,
  },
}));

vi.mock("@/lib/api/households", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/households")>()),
  getHouseholds: mocks.getHouseholds,
  createHousehold: mocks.createHousehold,
  getHouseholdMembers: mocks.getHouseholdMembers,
  getHouseholdInvitations: mocks.getHouseholdInvitations,
  getIncomingHouseholdInvitations: mocks.getIncomingHouseholdInvitations,
}));

import { SettingsView } from "@/components/recipes/settings/settings-view";

function renderSettingsView() {
  return render(<SettingsView />);
}

const signedIn = {
  data: {
    user: {
      id: "robbie-user",
      name: "Robbie",
      email: "robbie@example.com",
      image: null,
    },
    session: { token: "current-token" },
  },
  isPending: false,
};

describe("SettingsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/recipes/settings");
    mocks.useSession.mockReturnValue(signedIn);
    mocks.updateUser.mockResolvedValue({ data: null, error: null });
    mocks.listAccounts.mockResolvedValue({
      data: [{ providerId: "google", accountId: "g1" }],
      error: null,
    });
    mocks.listSessions.mockResolvedValue({
      data: [
        {
          token: "current-token",
          userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Chrome/120",
          updatedAt: new Date(),
        },
      ],
      error: null,
    });
    mocks.getHouseholds.mockResolvedValue([]);
    mocks.getHouseholdMembers.mockResolvedValue([]);
    mocks.getHouseholdInvitations.mockResolvedValue([]);
    mocks.getIncomingHouseholdInvitations.mockResolvedValue([]);
    mocks.createHousehold.mockResolvedValue({});
  });

  it("prompts to sign in when there is no session", () => {
    mocks.useSession.mockReturnValue({ data: null, isPending: false });
    renderSettingsView();

    expect(screen.getByText("Sign in to open settings.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /back to recipes/i }),
    ).toHaveAttribute("href", "/recipes");
  });

  it("shows the account panel with name and email", () => {
    renderSettingsView();

    expect(screen.getByLabelText("Display name")).toHaveValue("Robbie");
    expect(screen.getByText("robbie@example.com")).toBeInTheDocument();
  });

  it("saves a new display name after editing", async () => {
    const user = userEvent.setup();
    renderSettingsView();

    const input = screen.getByLabelText("Display name");
    await user.clear(input);
    await user.type(input, "Rob");
    await user.tab();

    await waitFor(() =>
      expect(mocks.updateUser).toHaveBeenCalledWith({ name: "Rob" }),
    );
  });

  it("rejects an empty display name without saving", async () => {
    const user = userEvent.setup();
    renderSettingsView();

    const input = screen.getByLabelText("Display name");
    await user.clear(input);
    await user.tab();

    expect(await screen.findByText(/can't be empty/i)).toBeInTheDocument();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("shows linked accounts and offers to link the other provider", async () => {
    const user = userEvent.setup();
    renderSettingsView();

    await user.click(
      screen.getByRole("button", { name: /sign-in & security/i }),
    );

    expect(await screen.findByText("Google")).toBeInTheDocument();
    expect(
      screen.getByText("can't unlink your only sign-in"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /github/i })).toBeInTheDocument();
    expect(screen.getByText("this device")).toBeInTheDocument();
  });

  it("offers household creation when the user has no household", async () => {
    const user = userEvent.setup();
    renderSettingsView();

    await user.click(screen.getByRole("button", { name: "Household" }));

    expect(await screen.findByText("Start a household.")).toBeInTheDocument();
    expect(screen.getByLabelText("Household name")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create household/i }),
    ).toBeInTheDocument();
  });

  it("requires a successful household lookup before offering creation", async () => {
    const user = userEvent.setup();
    mocks.getHouseholds
      .mockRejectedValueOnce(new Error("Household service unavailable"))
      .mockResolvedValueOnce([]);
    renderSettingsView();

    await user.click(screen.getByRole("button", { name: "Household" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Household service unavailable",
    );
    expect(screen.queryByText("Start a household.")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Start a household.")).toBeInTheDocument();
  });

  it("still offers creation when only incoming invitations fail to load", async () => {
    const user = userEvent.setup();
    mocks.getIncomingHouseholdInvitations.mockRejectedValueOnce(
      new Error("Invitations unavailable"),
    );
    renderSettingsView();

    await user.click(screen.getByRole("button", { name: "Household" }));

    expect(await screen.findByText("Start a household.")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Invitations unavailable",
    );
  });

  it("serializes household creation attempts", async () => {
    const user = userEvent.setup();
    let resolveCreate: (() => void) | undefined;
    mocks.createHousehold.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveCreate = resolve;
      }),
    );
    renderSettingsView();

    await user.click(screen.getByRole("button", { name: "Household" }));
    await user.type(
      await screen.findByLabelText("Household name"),
      "Park Road",
    );
    const createButton = screen.getByRole("button", {
      name: /create household/i,
    });
    const form = createButton.closest("form");
    expect(form).not.toBeNull();

    fireEvent.submit(form as HTMLFormElement);
    fireEvent.submit(form as HTMLFormElement);

    expect(mocks.createHousehold).toHaveBeenCalledTimes(1);
    expect(createButton).toBeDisabled();
    resolveCreate?.();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /create household/i }),
      ).not.toBeDisabled(),
    );
  });

  it("opens on the security panel and surfaces a link error from the URL", async () => {
    window.history.replaceState(
      {},
      "",
      "/recipes/settings?error=account_already_linked",
    );
    renderSettingsView();

    // Lands on Sign-in & security without a manual tab switch.
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /couldn't link that account/i,
    );
    expect(await screen.findByText("Google")).toBeInTheDocument();
    expect(window.location.search).toBe("");
  });
});
