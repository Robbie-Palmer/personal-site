import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/tests/test-utils";

const mocks = vi.hoisted(() => ({
  slug: "weeknight-rice",
  useSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams({ slug: mocks.slug }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: mocks.useSession },
}));

vi.mock("@/components/recipes/add-recipe-view", () => ({
  AddRecipeView: ({ initialRecipe }: { initialRecipe: { title: string } }) => (
    <div>Editing {initialRecipe.title}</div>
  ),
}));

import { EditRecipeView } from "@/components/recipes/edit-recipe-view";
import {
  errorMessage,
  isAbortError,
} from "@/components/recipes/recipe-load-state";

const originalFetch = globalThis.fetch;

const recipe = {
  slug: "weeknight-rice",
  title: "Weeknight Rice",
  description: "A quick dinner.",
  body: "{}",
  visibility: "private" as const,
  createdAt: "2026-07-22T12:00:00.000Z",
  updatedAt: "2026-07-22T12:00:00.000Z",
  owned: true,
};

beforeEach(() => {
  mocks.slug = "weeknight-rice";
  mocks.useSession.mockReturnValue({
    data: { user: { id: "recipe-owner" } },
    isPending: false,
  });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("EditRecipeView", () => {
  it("loads an owned recipe into the editor", async () => {
    globalThis.fetch = vi.fn(async () => Response.json(recipe)) as typeof fetch;

    render(<EditRecipeView />);

    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
    expect(
      await screen.findByText("Editing Weeknight Rice"),
    ).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/recipes/weeknight-rice",
      expect.objectContaining({
        credentials: "same-origin",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("rejects an invalid recipe slug without making a request", async () => {
    mocks.slug = "Not a slug";
    globalThis.fetch = vi.fn();

    render(<EditRecipeView />);

    expect(
      await screen.findByRole("heading", { name: "Recipe unavailable" }),
    ).toBeInTheDocument();
    expect(screen.getByText("No recipe was selected.")).toBeInTheDocument();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("does not allow a non-owner to edit the recipe", async () => {
    globalThis.fetch = vi.fn(async () =>
      Response.json({ ...recipe, owned: false }),
    ) as typeof fetch;

    render(<EditRecipeView />);

    expect(
      await screen.findByText("Only the recipe owner can edit it."),
    ).toBeInTheDocument();
  });

  it("shows a useful error when loading fails", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response(null, { status: 500 }),
    ) as typeof fetch;

    render(<EditRecipeView />);

    expect(
      await screen.findByText("The recipe could not be loaded."),
    ).toBeInTheDocument();
  });

  it("uses the fallback for an unexpected rejection", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw "network failure";
    }) as typeof fetch;

    render(<EditRecipeView />);

    expect(
      await screen.findByText("The recipe could not be loaded."),
    ).toBeInTheDocument();
  });
});

describe("recipe load errors", () => {
  it("recognizes aborts and preserves ordinary error messages", () => {
    expect(isAbortError(new DOMException("Aborted", "AbortError"))).toBe(true);
    expect(isAbortError(new Error("Other"))).toBe(false);
    expect(errorMessage(new Error("Specific"), "Fallback")).toBe("Specific");
    expect(errorMessage("unexpected", "Fallback")).toBe("Fallback");
  });
});
