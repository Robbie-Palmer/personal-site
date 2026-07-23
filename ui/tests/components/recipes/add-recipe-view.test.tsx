import { CooklangParser } from "@cooklang/cooklang";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getHouseholds: vi.fn(),
  routerPush: vi.fn(),
  useCooklangRecipe: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.routerPush }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: mocks.useSession },
}));

vi.mock("@/lib/api/households", () => ({
  getHouseholds: mocks.getHouseholds,
}));

vi.mock("@/hooks/use-cooklang-recipe", () => ({
  useCooklangRecipe: mocks.useCooklangRecipe,
}));

vi.mock("@/components/recipes/recipe-content", () => ({
  RecipeContent: ({ recipe }: { recipe: { title: string } }) => (
    <div>{recipe.title}</div>
  ),
}));

import { AddRecipeView } from "@/components/recipes/add-recipe-view";

const household = {
  id: "household-1",
  name: "Park Road kitchen",
  slug: "park-road",
  logo: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  membership: { id: "member-1", role: "owner" },
};

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("AddRecipeView visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useCooklangRecipe.mockReturnValue({
      recipe: null,
      loading: false,
      error: null,
    });
    mocks.useSession.mockReturnValue({
      data: { user: { id: "user-1", name: "Robbie" } },
      isPending: false,
    });
  });

  it("defaults to household sharing when membership is available", async () => {
    mocks.getHouseholds.mockResolvedValue([household]);

    render(<AddRecipeView />);

    expect(
      await screen.findByRole("button", { name: "Household", pressed: true }),
    ).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Public" }));
    expect(
      screen.getByRole("button", { name: "Public", pressed: true }),
    ).toBeInTheDocument();
  });

  it("falls back to private when the user has no household", async () => {
    mocks.getHouseholds.mockResolvedValue([]);

    render(<AddRecipeView />);

    expect(
      await screen.findByRole("button", { name: "Private", pressed: true }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Household" })).toBeDisabled();
  });

  it("preserves a visibility selected while household membership loads", async () => {
    let resolveHouseholds: (value: (typeof household)[]) => void = () => {};
    mocks.getHouseholds.mockReturnValue(
      new Promise((resolve) => {
        resolveHouseholds = resolve;
      }),
    );

    render(<AddRecipeView />);
    fireEvent.click(screen.getByRole("button", { name: "Public" }));
    resolveHouseholds([household]);

    expect(
      await screen.findByRole("button", { name: "Public", pressed: true }),
    ).toBeInTheDocument();
  });

  it("loads and updates an existing recipe without changing its slug", async () => {
    const source = "Cook @rice{200%g}.";
    const canonical = "https://example.test/weeknight-rice";
    const [parsedRecipe] = new CooklangParser().parse(source);
    mocks.useCooklangRecipe.mockReturnValue({
      recipe: parsedRecipe,
      loading: false,
      error: null,
    });
    mocks.getHouseholds.mockResolvedValue([]);
    globalThis.fetch = vi.fn(async () =>
      Response.json({ slug: "weeknight-rice" }),
    ) as typeof fetch;

    render(
      <AddRecipeView
        initialRecipe={{
          slug: "weeknight-rice",
          title: "Weeknight Rice",
          description: "A quick dinner.",
          body: JSON.stringify({
            version: 1,
            source,
            recipe: {
              title: "Weeknight Rice",
              description: "A quick dinner.",
              date: "2025-05-04",
              canonical,
              cuisine: ["Japanese"],
              servings: 2,
              tags: [],
              ingredientGroups: [
                {
                  items: [{ ingredient: "rice", amount: 200, unit: "g" }],
                },
              ],
              instructions: ["Cook the rice."],
              cookware: [],
              cookBody: source,
            },
          }),
          visibility: "private",
          createdAt: "2026-07-22T12:00:00.000Z",
          updatedAt: "2026-07-22T12:00:00.000Z",
          owned: true,
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Edit recipe" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Recipe name")).toHaveValue("Weeknight Rice");
    expect(screen.getByLabelText("Cuisine")).toHaveValue("Japanese");
    expect(screen.getByDisplayValue(source)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Private", pressed: true }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Import from URL" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      await screen.findByRole("button", { name: "Save changes" }),
    );

    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/recipes/weeknight-rice",
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
    const [, request] = vi.mocked(globalThis.fetch).mock.calls[0] ?? [];
    const requestBody = JSON.parse(String(request?.body));
    expect(Object.keys(requestBody).sort()).toEqual([
      "body",
      "description",
      "title",
      "visibility",
    ]);
    expect(JSON.parse(requestBody.body).recipe.canonical).toBe(canonical);
    expect(JSON.parse(requestBody.body).recipe.date).toBe("2025-05-04");
    expect(mocks.routerPush).toHaveBeenCalledWith(
      "/recipes/saved?slug=weeknight-rice",
    );
  });

  it("disables editing when the saved recipe body is unreadable", () => {
    mocks.getHouseholds.mockResolvedValue([]);

    render(
      <AddRecipeView
        initialRecipe={{
          slug: "broken-recipe",
          title: "Broken Recipe",
          description: "This body cannot be parsed.",
          body: "{",
          visibility: "private",
          createdAt: "2026-07-22T12:00:00.000Z",
          updatedAt: "2026-07-22T12:00:00.000Z",
          owned: true,
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Recipe unavailable" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Editing is disabled to avoid overwriting it/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save changes" }),
    ).not.toBeInTheDocument();
  });
});
