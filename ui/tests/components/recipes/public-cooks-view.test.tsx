import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  PublicCookProfile,
  PublicCookSummary,
} from "@/lib/api/public-cooks";
import { recipeQueryKeys } from "@/lib/query/recipe-query-keys";
import { fireEvent, render, screen, waitFor } from "@/tests/test-utils";

const mocks = vi.hoisted(() => ({
  getCookFollowStatus: vi.fn(),
  getPublicCook: vi.fn(),
  getPublicCooks: vi.fn(),
  setCookFollowing: vi.fn(),
  session: {
    data: null as { user: { id: string; name: string } } | null,
    isPending: false,
  },
  useSearchParams: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: mocks.useSearchParams,
}));

vi.mock("@/lib/api/public-cooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/public-cooks")>()),
  getCookFollowStatus: mocks.getCookFollowStatus,
  getPublicCook: mocks.getPublicCook,
  getPublicCooks: mocks.getPublicCooks,
  setCookFollowing: mocks.setCookFollowing,
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    getLastUsedLoginMethod: vi.fn(() => null),
    useSession: () => mocks.session,
  },
}));

import { PublicCooksView } from "@/components/recipes/public-cooks-view";

const summary = {
  id: "cook-1",
  name: "Ada Cook",
  image: null,
  activityCount: 2,
  latestRecipeTitle: "Ada's Stew",
} satisfies PublicCookSummary;

const profile = {
  id: "cook-1",
  name: "Ada Cook",
  image: null,
  followersCount: 1,
  followingCount: 1,
  followers: [{ id: "follower-1", name: "Grace Baker", image: null }],
  following: [{ id: "followed-1", name: "Lin Chef", image: null }],
  activity: [
    {
      type: "recipe_added",
      recipe: {
        slug: "ada-stew",
        title: "Ada's Stew",
        description: null,
        body: null,
        visibility: "public",
        createdAt: "2026-07-16T12:00:00.000Z",
        updatedAt: "2026-07-16T12:00:00.000Z",
      },
      createdAt: "2026-07-16T12:00:00.000Z",
    },
  ],
} satisfies PublicCookProfile;

describe("PublicCooksView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session.data = { user: { id: "viewer-1", name: "Viewer" } };
    mocks.useSearchParams.mockReturnValue(new URLSearchParams());
    mocks.getPublicCooks.mockResolvedValue([summary]);
    mocks.getPublicCook.mockResolvedValue(profile);
    mocks.getCookFollowStatus.mockResolvedValue({
      following: false,
      canFollow: true,
    });
    mocks.setCookFollowing.mockResolvedValue({
      following: true,
      canFollow: true,
    });
  });

  it("renders lightweight cook summaries", async () => {
    render(<PublicCooksView />);

    expect(await screen.findByText("Ada Cook")).toBeInTheDocument();
    expect(screen.getByText("Ada's Stew")).toBeInTheDocument();
    expect(mocks.getPublicCooks).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(mocks.getPublicCook).not.toHaveBeenCalled();
  });

  it("aborts the cooks request when unmounted", async () => {
    let resolveCooks: ((cooks: PublicCookSummary[]) => void) | undefined;
    mocks.getPublicCooks.mockReturnValue(
      new Promise<PublicCookSummary[]>((resolve) => {
        resolveCooks = resolve;
      }),
    );

    const { unmount } = render(<PublicCooksView />);
    const signal = mocks.getPublicCooks.mock.calls[0]?.[0] as AbortSignal;

    unmount();
    expect(signal.aborted).toBe(true);

    await act(async () => {
      resolveCooks?.([summary]);
    });
  });

  it("loads a selected cook directly", async () => {
    mocks.useSearchParams.mockReturnValue(new URLSearchParams("cook=cook-1"));

    render(<PublicCooksView />);

    expect(
      await screen.findByRole("heading", {
        name: /Ada.*recipe activity/,
      }),
    ).toBeInTheDocument();
    expect(mocks.getPublicCook).toHaveBeenCalledWith(
      "cook-1",
      expect.any(AbortSignal),
    );
    expect(mocks.getPublicCooks).not.toHaveBeenCalled();
    expect(mocks.getCookFollowStatus).toHaveBeenCalledWith(
      "cook-1",
      expect.any(AbortSignal),
    );
    expect(screen.getByText("1 Followers")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Grace Baker/ })).toHaveAttribute(
      "href",
      "/recipes/cooks?cook=follower-1",
    );
    expect(screen.getByText("1 Following")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Lin Chef/ })).toHaveAttribute(
      "href",
      "/recipes/cooks?cook=followed-1",
    );
  });

  it("shows full connection totals when the profile contains a bounded preview", async () => {
    mocks.useSearchParams.mockReturnValue(new URLSearchParams("cook=cook-1"));
    mocks.getPublicCook.mockResolvedValue({
      ...profile,
      followersCount: 55,
    });

    render(<PublicCooksView />);

    expect(await screen.findByText("55 Followers")).toBeInTheDocument();
    expect(screen.getByText("Showing the 1 most recent.")).toBeInTheDocument();
  });

  it("follows a cook from their profile", async () => {
    mocks.useSearchParams.mockReturnValue(new URLSearchParams("cook=cook-1"));

    const { queryClient } = render(<PublicCooksView />);
    queryClient.setQueryData(recipeQueryKeys.publicCook("viewer-1"), profile);

    const followButton = await screen.findByRole("button", { name: "Follow" });
    await waitFor(() => expect(followButton).toBeEnabled());
    fireEvent.click(followButton);

    await waitFor(() =>
      expect(mocks.setCookFollowing).toHaveBeenCalledWith("cook-1", true),
    );
    await waitFor(() => expect(mocks.getPublicCook).toHaveBeenCalledTimes(2));
    expect(
      queryClient.getQueryState(recipeQueryKeys.publicCook("viewer-1"))
        ?.isInvalidated,
    ).toBe(true);
    expect(
      await screen.findByRole("button", { name: "Following" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("unfollows a cook from their profile", async () => {
    mocks.useSearchParams.mockReturnValue(new URLSearchParams("cook=cook-1"));
    mocks.getCookFollowStatus.mockResolvedValue({
      following: true,
      canFollow: true,
    });
    mocks.setCookFollowing.mockResolvedValue({
      following: false,
      canFollow: true,
    });

    render(<PublicCooksView />);

    const followingButton = await screen.findByRole("button", {
      name: "Following",
    });
    await waitFor(() => expect(followingButton).toBeEnabled());
    fireEvent.click(followingButton);

    await waitFor(() =>
      expect(mocks.setCookFollowing).toHaveBeenCalledWith("cook-1", false),
    );
    expect(
      await screen.findByRole("button", { name: "Follow" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("asks signed-out visitors to log in before following", async () => {
    mocks.session.data = null;
    mocks.useSearchParams.mockReturnValue(new URLSearchParams("cook=cook-1"));

    render(<PublicCooksView />);

    expect(
      await screen.findByRole("button", { name: "Log in to follow" }),
    ).toBeInTheDocument();
    expect(mocks.getCookFollowStatus).not.toHaveBeenCalled();
  });

  it("does not show follow controls on the viewer's own profile", async () => {
    mocks.session.data = { user: { id: "cook-1", name: "Ada Cook" } };
    mocks.useSearchParams.mockReturnValue(new URLSearchParams("cook=cook-1"));

    render(<PublicCooksView />);

    expect(
      await screen.findByRole("heading", {
        name: /Ada.*recipe activity/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Follow" }),
    ).not.toBeInTheDocument();
    expect(mocks.getCookFollowStatus).not.toHaveBeenCalled();
  });

  it("shows follow-status errors without hiding the profile", async () => {
    mocks.useSearchParams.mockReturnValue(new URLSearchParams("cook=cook-1"));
    mocks.getCookFollowStatus.mockRejectedValue(
      new Error("Follow status unavailable"),
    );

    render(<PublicCooksView />);

    expect(
      await screen.findByText("Follow status unavailable"),
    ).toHaveAttribute("role", "alert");
    expect(screen.getByText("Ada's Stew")).toBeInTheDocument();
  });

  it("reuses the directory and profile when navigating around in a loop", async () => {
    const view = render(<PublicCooksView />);
    expect(await screen.findByText("Ada Cook")).toBeInTheDocument();

    mocks.useSearchParams.mockReturnValue(new URLSearchParams("cook=cook-1"));
    view.rerender(<PublicCooksView />);
    expect(
      await screen.findByRole("heading", {
        name: /Ada.*recipe activity/,
      }),
    ).toBeInTheDocument();

    mocks.useSearchParams.mockReturnValue(new URLSearchParams());
    view.rerender(<PublicCooksView />);
    expect(await screen.findByText("Ada Cook")).toBeInTheDocument();

    mocks.useSearchParams.mockReturnValue(new URLSearchParams("cook=cook-1"));
    view.rerender(<PublicCooksView />);
    expect(
      await screen.findByRole("heading", {
        name: /Ada.*recipe activity/,
      }),
    ).toBeInTheDocument();
    expect(mocks.getPublicCooks).toHaveBeenCalledTimes(1);
    expect(mocks.getPublicCook).toHaveBeenCalledTimes(1);
  });

  it("shows request errors instead of a missing-cook message", async () => {
    mocks.useSearchParams.mockReturnValue(
      new URLSearchParams("cook=older-cook"),
    );
    mocks.getPublicCook.mockRejectedValue(new Error("Service unavailable"));

    render(<PublicCooksView />);

    expect(
      await screen.findByText("The kitchen is quiet."),
    ).toBeInTheDocument();
    expect(screen.getByText("Service unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Cook not found.")).not.toBeInTheDocument();
  });

  it("names the selected cook when a non-Error request fails", async () => {
    mocks.useSearchParams.mockReturnValue(new URLSearchParams("cook=cook-1"));
    mocks.getPublicCook.mockRejectedValue("offline");

    render(<PublicCooksView />);

    expect(
      await screen.findAllByText("This cook could not be loaded."),
    ).toHaveLength(2);
  });
});
