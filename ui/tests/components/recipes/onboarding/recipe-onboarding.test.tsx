import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RecipeCardView } from "@/lib/api/recipes";

const mocks = vi.hoisted(() => ({
  getDietOptions: vi.fn(),
  getDietProfile: vi.fn(),
  getRecipeBoxProfile: vi.fn(),
  saveDietProfile: vi.fn(),
  saveRecipeBoxProfile: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: mocks.useSession },
}));

vi.mock("@/lib/api/diet", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/diet")>()),
  getDietOptions: mocks.getDietOptions,
  getDietProfile: mocks.getDietProfile,
  saveDietProfile: mocks.saveDietProfile,
}));

vi.mock("@/lib/api/recipe-box", () => ({
  getRecipeBoxProfile: mocks.getRecipeBoxProfile,
  saveRecipeBoxProfile: mocks.saveRecipeBoxProfile,
}));

vi.mock("@/components/recipes/recipe-card", () => ({
  RecipeThumb: () => null,
  recipeMetaLabel: () => "",
}));

import { RecipeOnboarding } from "@/components/recipes/onboarding/recipe-onboarding";

const emptyDiet = {
  presetDietKeys: [],
  excludedIngredientSlugs: [],
  excludedGroupKeys: [],
  recipeMatchMode: "hide" as const,
};

const recipe = {
  slug: "vegan-soup",
  title: "Vegan Soup",
  ingredientSlugs: ["lentils"],
  ingredientNames: ["Lentils"],
} as RecipeCardView;

describe("RecipeOnboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/recipes/onboarding");
    mocks.useSession.mockReturnValue({
      data: { user: { id: "qa-user" } },
      isPending: false,
    });
    mocks.getDietProfile.mockResolvedValue(emptyDiet);
    mocks.getDietOptions.mockResolvedValue({
      presets: [],
      groups: [],
      ingredients: [],
    });
    mocks.getRecipeBoxProfile.mockResolvedValue({
      completed: false,
      staticRecipeSlugs: [],
    });
    mocks.saveDietProfile.mockResolvedValue(emptyDiet);
    mocks.saveRecipeBoxProfile.mockResolvedValue(undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: [], nextCursor: null }),
      }),
    );
  });

  it("continues with no diet selections without a redundant skip action", async () => {
    render(<RecipeOnboarding recipes={[recipe]} />);

    expect(
      await screen.findByRole("heading", { name: /anything you don't eat/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /skip/i }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(mocks.saveDietProfile).toHaveBeenCalledWith(emptyDiet);
    expect(
      await screen.findByRole("heading", { name: /put a few recipes in/i }),
    ).toBeInTheDocument();
  });

  it("preserves selected starters in the author-recipe return URL", async () => {
    const user = userEvent.setup();
    render(<RecipeOnboarding recipes={[recipe]} />);
    await screen.findByRole("heading", { name: /anything you don't eat/i });
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.click(screen.getByRole("button", { name: /vegan soup/i }));

    const href = screen.getByRole("link", { name: /write your own/i });
    const addURL = new URL(
      href.getAttribute("href") ?? "",
      "https://recipes.example.test",
    );

    expect(addURL.searchParams.get("returnTo")).toContain(
      "selected=vegan-soup",
    );
  });

  it("lets the user return from completion to correct recipe choices", async () => {
    const user = userEvent.setup();
    render(<RecipeOnboarding recipes={[recipe]} />);
    await screen.findByRole("heading", { name: /anything you don't eat/i });
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.click(screen.getByRole("button", { name: /vegan soup/i }));
    await user.click(screen.getByRole("button", { name: /finish setup/i }));

    await waitFor(() =>
      expect(mocks.saveRecipeBoxProfile).toHaveBeenCalledWith(["vegan-soup"]),
    );
    await user.click(screen.getByRole("button", { name: /back to choices/i }));

    expect(
      screen.getByRole("heading", { name: /put a few recipes in/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /vegan soup/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("uses completed progress steps as back navigation", async () => {
    const user = userEvent.setup();
    render(<RecipeOnboarding recipes={[recipe]} />);
    await screen.findByRole("heading", { name: /anything you don't eat/i });
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await user.click(
      screen.getByRole("button", { name: /go back to your diet/i }),
    );
    expect(
      screen.getByRole("heading", { name: /anything you don't eat/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.click(screen.getByRole("button", { name: /vegan soup/i }));
    await user.click(screen.getByRole("button", { name: /finish setup/i }));
    await user.click(
      await screen.findByRole("button", {
        name: /go back to fill your box/i,
      }),
    );

    expect(
      screen.getByRole("heading", { name: /put a few recipes in/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /vegan soup/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
