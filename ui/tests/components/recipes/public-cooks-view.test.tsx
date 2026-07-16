import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  DiscoverFeedItem,
  DiscoverFeedPage,
} from "@/lib/api/discover-feed";

const mocks = vi.hoisted(() => ({
  getDiscoverFeedPage: vi.fn(),
  useSearchParams: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: mocks.useSearchParams,
}));

vi.mock("@/lib/api/discover-feed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/discover-feed")>()),
  getDiscoverFeedPage: mocks.getDiscoverFeedPage,
}));

import { PublicCooksView } from "@/components/recipes/public-cooks-view";

const validItem = {
  type: "recipe_added",
  author: { id: "cook-1", name: "Ada Cook", image: null },
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
} satisfies DiscoverFeedItem;

describe("PublicCooksView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useSearchParams.mockReturnValue(new URLSearchParams());
  });

  it("ignores malformed activity without an author", async () => {
    const malformedItem = {
      ...validItem,
      author: null,
      recipe: { ...validItem.recipe, slug: "broken", title: "Broken Dish" },
    } as unknown as DiscoverFeedItem;
    mocks.getDiscoverFeedPage.mockResolvedValue({
      items: [malformedItem, validItem],
      nextCursor: null,
    } satisfies DiscoverFeedPage);

    render(<PublicCooksView />);

    expect(await screen.findByText("Ada Cook")).toBeInTheDocument();
    expect(screen.queryByText("Broken Dish")).not.toBeInTheDocument();
  });

  it("aborts the feed request when unmounted", async () => {
    let resolvePage: ((page: DiscoverFeedPage) => void) | undefined;
    mocks.getDiscoverFeedPage.mockReturnValue(
      new Promise<DiscoverFeedPage>((resolve) => {
        resolvePage = resolve;
      }),
    );

    const { unmount } = render(<PublicCooksView />);
    const signal = mocks.getDiscoverFeedPage.mock.calls[0]?.[2] as AbortSignal;

    unmount();
    expect(signal.aborted).toBe(true);

    await act(async () => {
      resolvePage?.({ items: [validItem], nextCursor: null });
    });
  });

  it("explains that a missing cook may be outside the activity window", async () => {
    mocks.useSearchParams.mockReturnValue(
      new URLSearchParams("cook=older-cook"),
    );
    mocks.getDiscoverFeedPage.mockResolvedValue({
      items: [validItem],
      nextCursor: null,
    } satisfies DiscoverFeedPage);

    render(<PublicCooksView />);

    expect(
      await screen.findByText("No recent activity found."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/30 most recent public recipe additions/),
    ).toBeInTheDocument();
  });
});
