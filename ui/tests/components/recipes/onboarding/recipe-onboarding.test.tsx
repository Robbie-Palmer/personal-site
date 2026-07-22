import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SavedRecipeApiRecord } from "@/lib/domain/recipe/recipeDraft";

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

vi.mock("@/lib/api/recipes", () => ({
  recipeRecordsToCards: (records: Array<{ slug: string; title: string }>) =>
    records.map((record) => ({
      ...record,
      ingredientSlugs: ["lentils"],
      ingredientNames: ["Lentils"],
    })),
}));

vi.mock("@/lib/domain/recipe/recipeDraft", () => ({
  savedRecipeCard: (record: { slug: string; title: string }) => ({
    ...record,
    ingredientSlugs: ["lentils"],
    ingredientNames: ["Lentils"],
  }),
}));

import { RecipeOnboarding } from "@/components/recipes/onboarding/recipe-onboarding";

const emptyDiet = {
  presetDietKeys: [],
  excludedIngredientSlugs: [],
  excludedGroupKeys: [],
  recipeMatchMode: "hide" as const,
};

function recipeRecord(slug: string, title: string): SavedRecipeApiRecord {
  return {
    slug,
    title,
    description: null,
    body: null,
    visibility: "public",
    createdAt: "2026-07-22T00:00:00.000Z",
    updatedAt: "2026-07-22T00:00:00.000Z",
  };
}

const veganSoup = recipeRecord("vegan-soup", "Vegan Soup");

function stubRecipeFetch({
  owned = [],
  readable = [veganSoup],
}: {
  owned?: SavedRecipeApiRecord[];
  readable?: SavedRecipeApiRecord[];
} = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = new URL(String(input), "https://recipes.example.test");
      const items =
        url.searchParams.get("scope") === "owned" ? owned : readable;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ items, nextCursor: null }),
      });
    }),
  );
}

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
      recipeSlugs: [],
    });
    mocks.saveDietProfile.mockResolvedValue(emptyDiet);
    mocks.saveRecipeBoxProfile.mockResolvedValue(undefined);
    stubRecipeFetch();
  });

  it("continues with no diet selections without a redundant skip action", async () => {
    render(<RecipeOnboarding />);

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

  it("does not offer recipes the onboarding user already owns", async () => {
    const ownedRecipe = recipeRecord("owned-stew", "Owned Stew");
    stubRecipeFetch({
      owned: [ownedRecipe],
      readable: [ownedRecipe, veganSoup],
    });
    const user = userEvent.setup();

    render(<RecipeOnboarding />);
    await screen.findByRole("heading", { name: /anything you don't eat/i });
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(
      screen.queryByRole("button", { name: /owned stew/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /vegan soup/i }),
    ).toBeInTheDocument();
  });

  it("preserves selected starters in the author-recipe return URL", async () => {
    const user = userEvent.setup();
    render(<RecipeOnboarding />);
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
    render(<RecipeOnboarding />);
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
    render(<RecipeOnboarding />);
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
