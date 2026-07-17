import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  PublicCookProfile,
  PublicCookSummary,
} from "@/lib/api/public-cooks";

const mocks = vi.hoisted(() => ({
  getPublicCook: vi.fn(),
  getPublicCooks: vi.fn(),
  useSearchParams: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: mocks.useSearchParams,
}));

vi.mock("@/lib/api/public-cooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/public-cooks")>()),
  getPublicCook: mocks.getPublicCook,
  getPublicCooks: mocks.getPublicCooks,
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
    mocks.useSearchParams.mockReturnValue(new URLSearchParams());
    mocks.getPublicCooks.mockResolvedValue([summary]);
    mocks.getPublicCook.mockResolvedValue(profile);
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
});
