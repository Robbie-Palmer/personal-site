import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiscoverFeed } from "@/components/recipes/discover-feed";
import { recipeQueryKeys } from "@/lib/query/recipe-query-keys";
import { fireEvent, render, screen, waitFor } from "@/tests/test-utils";

const auth = vi.hoisted(() => ({
  session: {
    data: { user: { id: "user-1", name: "Robbie" } },
    isPending: false,
  },
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => auth.session },
}));

const originalFetch = globalThis.fetch;
const originalIntersectionObserver = globalThis.IntersectionObserver;

function feedItem(slug: string, title: string) {
  return {
    type: "recipe_added",
    recipe: {
      slug,
      title,
      description: `${title} description`,
      visibility: "public",
      createdAt: "2026-07-24T12:00:00.000Z",
      updatedAt: "2026-07-24T12:00:00.000Z",
      owned: false,
      body: "{}",
    },
    author: { id: "cook-1", name: "Home Cook", image: null },
    createdAt: "2026-07-24T12:00:00.000Z",
  };
}

function DiscoverHarness() {
  const [visible, setVisible] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setVisible((current) => !current)}>
        Toggle discover
      </button>
      {visible ? <DiscoverFeed /> : null}
    </>
  );
}

beforeEach(() => {
  class IdleIntersectionObserver implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = "0px";
    readonly scrollMargin = "0px";
    readonly thresholds = [0];
    disconnect = vi.fn();
    observe = vi.fn();
    takeRecords = vi.fn(() => []);
    unobserve = vi.fn();
  }
  globalThis.IntersectionObserver = IdleIntersectionObserver;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.IntersectionObserver = originalIntersectionObserver;
  vi.restoreAllMocks();
});

describe("DiscoverFeed", () => {
  it("reuses cached public and household feeds across tabs and remounts", async () => {
    globalThis.fetch = vi.fn(async (input) => {
      const url = String(input);
      return Response.json({
        items: [
          url.includes("scope=household")
            ? feedItem("household-stew", "Household Stew")
            : feedItem("public-soup", "Public Soup"),
        ],
        nextCursor: null,
      });
    }) as typeof fetch;

    const { queryClient } = render(<DiscoverHarness />);

    expect(await screen.findByText("Public Soup")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Household" }));
    expect(await screen.findByText("Household Stew")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Public" }));
    expect(screen.getByText("Public Soup")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Toggle discover" }));
    fireEvent.click(screen.getByRole("button", { name: "Toggle discover" }));
    expect(screen.getByText("Public Soup")).toBeInTheDocument();

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2));
    expect(
      queryClient.getQueryData(recipeQueryKeys.publicDiscoverFeed()),
    ).toBeDefined();
    expect(
      queryClient.getQueryData(recipeQueryKeys.householdDiscoverFeed("user-1")),
    ).toBeDefined();
  });
});
