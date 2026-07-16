import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useSession: vi.fn(),
  getHouseholds: vi.fn(),
  getHouseholdMembers: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: mocks.useSession },
}));

vi.mock("@/lib/api/households", () => ({
  getHouseholds: mocks.getHouseholds,
  getHouseholdMembers: mocks.getHouseholdMembers,
}));

import { ProfileView } from "@/components/recipes/profile/profile-view";

const household = {
  id: "household-1",
  name: "Park Road kitchen",
  slug: "park-road",
  logo: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  membership: { id: "member-1", role: "owner" },
};

const members = [
  {
    id: "member-1",
    role: "owner",
    createdAt: "2026-01-01T00:00:00.000Z",
    user: {
      id: "user-1",
      name: "Robbie Palmer",
      email: "robbie@example.com",
      image: null,
    },
  },
  {
    id: "member-2",
    role: "member",
    createdAt: "2026-01-02T00:00:00.000Z",
    user: {
      id: "user-2",
      name: "Ellie Example",
      email: "ellie@example.com",
      image: null,
    },
  },
];

describe("ProfileView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useSession.mockReturnValue({
      data: {
        user: {
          id: "user-1",
          name: "Robbie Palmer",
          email: "robbie@example.com",
          image: null,
        },
      },
      isPending: false,
    });
    mocks.getHouseholds.mockResolvedValue([household]);
    mocks.getHouseholdMembers.mockResolvedValue(members);
  });

  it("shows the selected member and links every household member profile", async () => {
    render(<ProfileView userId="user-2" />);

    expect(
      await screen.findByRole("heading", { name: /Ellie's kitchen/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Park Road kitchen")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Robbie Palmer/ })).toHaveAttribute(
      "href",
      "/recipes/profile?user=user-1",
    );
    expect(screen.getByRole("link", { name: /Ellie Example/ })).toHaveAttribute(
      "href",
      "/recipes/profile?user=user-2",
    );
    expect(screen.queryByText("robbie@example.com")).not.toBeInTheDocument();
  });

  it("shows profile settings only on the signed-in user's page", async () => {
    const { rerender } = render(<ProfileView userId="user-1" />);

    expect(
      await screen.findByRole("link", { name: /settings/i }),
    ).toHaveAttribute("href", "/recipes/settings");

    rerender(<ProfileView userId="user-2" />);
    await screen.findByRole("heading", { name: /Ellie's kitchen/i });
    expect(
      screen.queryByRole("link", { name: /^settings$/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the signed-in user's profile without a household", async () => {
    mocks.getHouseholds.mockResolvedValue([]);

    render(<ProfileView />);

    expect(
      await screen.findByRole("heading", { name: /Robbie's kitchen/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /settings/i })).toHaveAttribute(
      "href",
      "/recipes/settings",
    );
    expect(screen.queryByText("Household")).not.toBeInTheDocument();
    expect(mocks.getHouseholdMembers).not.toHaveBeenCalled();
  });

  it("does not expose profiles outside the current household", async () => {
    render(<ProfileView userId="unknown-user" />);

    expect(await screen.findByText("Profile unavailable")).toBeInTheDocument();
    expect(
      screen.getByText("This profile isn't part of your household."),
    ).toBeInTheDocument();
  });

  it("uses a grammatical fallback when a member has no display name", async () => {
    mocks.getHouseholdMembers.mockResolvedValue([
      {
        ...members[1],
        user: { ...members[1]?.user, name: "" },
      },
    ]);

    render(<ProfileView userId="user-2" />);

    expect(
      await screen.findByRole("heading", { name: /Chef's kitchen/i }),
    ).toBeInTheDocument();
  });

  it("ignores a stale response after navigating to another profile", async () => {
    let resolveFirstMembers: ((value: typeof members) => void) | undefined;
    const firstMembers = new Promise<typeof members>((resolve) => {
      resolveFirstMembers = resolve;
    });
    mocks.getHouseholdMembers
      .mockReturnValueOnce(firstMembers)
      .mockResolvedValueOnce(members);

    const { rerender } = render(<ProfileView userId="user-1" />);
    await waitFor(() =>
      expect(mocks.getHouseholdMembers).toHaveBeenCalledOnce(),
    );

    rerender(<ProfileView userId="user-2" />);
    expect(
      await screen.findByRole("heading", { name: /Ellie's kitchen/i }),
    ).toBeInTheDocument();

    await act(async () => resolveFirstMembers?.(members));
    expect(
      screen.queryByRole("heading", { name: /Robbie's kitchen/i }),
    ).not.toBeInTheDocument();
  });
});
