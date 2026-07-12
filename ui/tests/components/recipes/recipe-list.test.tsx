import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecipeList } from "@/components/recipes/recipe-list";
import type { RecipeCardView } from "@/lib/api/recipes";

const replaceMock = vi.fn();
const dietTestState = vi.hoisted(() => ({
  mode: "none" as "none" | "hide" | "warn",
}));

let currentSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  usePathname: () => "/recipes",
  useRouter: () => ({
    replace: replaceMock,
  }),
  useSearchParams: () => currentSearchParams,
}));

vi.mock("posthog-js", () => ({
  default: {
    capture: vi.fn(),
  },
}));

vi.mock("@/lib/integrations/cloudflare-images", () => ({
  getImageUrl: (image: string) => image,
}));

vi.mock("@/components/recipes/diet-provider", () => ({
  useDiet: () => ({
    diet: {
      active: dietTestState.mode !== "none",
      labels: ["Vegetarian"],
      mode: dietTestState.mode === "warn" ? "warn" : "hide",
    },
    matchRecipe: (recipe: { ingredients: { slug: string }[] }) => {
      const excludedIngredients = recipe.ingredients
        .filter((ingredient) => ingredient.slug === "chicken-breast")
        .map((ingredient) => ({
          slug: ingredient.slug,
          name: "Chicken breast",
        }));
      return {
        matches: excludedIngredients.length === 0,
        excludedIngredients,
      };
    },
  }),
}));

const recipes: RecipeCardView[] = [
  {
    slug: "slow-cooker-mexican-chicken",
    title: "Slow Cooker Mexican Chicken",
    description: "Slow cooker chicken for tacos.",
    date: "2026-02-12",
    cuisine: ["Mexican"],
    tags: [],
    servings: 4,
    prepTime: 15,
    cookTime: 240,
    totalTime: 255,
    ingredientNames: ["chicken breast", "white onion"],
    ingredientSlugs: ["chicken-breast", "white-onion"],
    cookware: ["fork", "oven", "slow cooker"],
  },
  {
    slug: "chicken-quesadillas",
    title: "Chicken Quesadillas",
    description: "Crisp quesadillas with chipotle mayo.",
    date: "2026-02-10",
    cuisine: ["Mexican"],
    tags: [],
    servings: 4,
    prepTime: 20,
    cookTime: 30,
    totalTime: 50,
    ingredientNames: ["chicken breast", "cheddar cheese"],
    ingredientSlugs: ["chicken-breast", "cheddar-cheese"],
    cookware: ["baking tray", "bowl", "fork", "frying pan", "oven", "spoon"],
  },
  {
    slug: "creamy-pesto-risotto",
    title: "Creamy Pesto Risotto",
    description: "Creamy risotto with pesto.",
    date: "2026-02-08",
    cuisine: ["Italian"],
    tags: [],
    servings: 4,
    prepTime: 10,
    cookTime: 30,
    totalTime: 40,
    ingredientNames: ["arborio rice", "pesto"],
    ingredientSlugs: ["arborio-rice", "pesto"],
    cookware: ["bowl", "saucepan"],
  },
];

describe("RecipeList", () => {
  beforeEach(() => {
    currentSearchParams = new URLSearchParams();
    replaceMock.mockReset();
    dietTestState.mode = "none";
  });

  it("hides diet mismatches and lets the user temporarily show them", async () => {
    dietTestState.mode = "hide";
    const user = userEvent.setup();
    const onDietVisibleCountChange = vi.fn();

    render(
      <RecipeList
        recipes={recipes}
        onDietVisibleCountChange={onDietVisibleCountChange}
      />,
    );

    expect(screen.queryByText("Chicken Quesadillas")).not.toBeInTheDocument();
    expect(screen.getByText("Creamy Pesto Risotto")).toBeInTheDocument();
    expect(screen.getByText(/2 recipes hidden/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(onDietVisibleCountChange).toHaveBeenCalledWith(1),
    );

    await user.click(screen.getByRole("button", { name: /show anyway/i }));

    expect(screen.getByText("Chicken Quesadillas")).toBeInTheDocument();
    expect(screen.getAllByText(/doesn't match your diet/i)).toHaveLength(2);
    await waitFor(() =>
      expect(onDietVisibleCountChange).toHaveBeenCalledWith(3),
    );
  });

  it("keeps diet mismatches visible with warnings in warn mode", () => {
    dietTestState.mode = "warn";

    render(<RecipeList recipes={recipes} />);

    expect(screen.getByText("Chicken Quesadillas")).toBeInTheDocument();
    expect(screen.getAllByText(/doesn't match your diet/i)).toHaveLength(2);
    expect(screen.getByText(/marked with a warning/i)).toBeInTheDocument();
  });

  it("shows an equipment filter with cookware options", async () => {
    const user = userEvent.setup();

    render(<RecipeList recipes={recipes} />);

    const equipmentLabel = screen.getByText("Equipment:");
    const equipmentFilter = equipmentLabel.closest('[role="combobox"]');
    expect(equipmentFilter).not.toBeNull();
    if (!equipmentFilter) throw new Error("Equipment filter not found");

    await user.click(equipmentFilter);

    expect(screen.getByRole("button", { name: "fork" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "slow cooker" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "saucepan" }),
    ).toBeInTheDocument();
  });

  it("applies the equipment filter via the equipment query param", () => {
    currentSearchParams = new URLSearchParams("equipment=slow cooker");

    render(<RecipeList recipes={recipes} />);

    expect(screen.getByText("Showing 1 of 3 recipes")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Slow Cooker Mexican Chicken" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Chicken Quesadillas" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Creamy Pesto Risotto" }),
    ).not.toBeInTheDocument();
  });

  it("filters recipes from the inline search field", async () => {
    const user = userEvent.setup();

    render(<RecipeList recipes={recipes} />);

    await user.type(
      screen.getByPlaceholderText("Search 3 recipes…"),
      "risotto",
    );

    expect(
      screen.getByText('Showing 1 of 3 recipes matching "risotto"'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Creamy Pesto Risotto" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Slow Cooker Mexican Chicken" }),
    ).not.toBeInTheDocument();
  });

  it("hydrates recipe search from the q query param", () => {
    currentSearchParams = new URLSearchParams("q=risotto");

    render(<RecipeList recipes={recipes} />);

    expect(screen.getByPlaceholderText("Search 3 recipes…")).toHaveValue(
      "risotto",
    );
    expect(
      screen.getByText('Showing 1 of 3 recipes matching "risotto"'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Creamy Pesto Risotto" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Slow Cooker Mexican Chicken" }),
    ).not.toBeInTheDocument();
  });

  it("keeps newer typed input when its own debounced URL update lands", async () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(<RecipeList recipes={recipes} />);
      const input = screen.getByPlaceholderText("Search 3 recipes…");

      fireEvent.change(input, { target: { value: "ri" } });
      await act(async () => {
        vi.advanceTimersByTime(300);
      });
      expect(replaceMock).toHaveBeenLastCalledWith("/recipes?q=ri", {
        scroll: false,
      });

      fireEvent.change(input, { target: { value: "ris" } });
      currentSearchParams = new URLSearchParams("q=ri");
      rerender(<RecipeList recipes={recipes} />);

      expect(input).toHaveValue("ris");
    } finally {
      vi.useRealTimers();
    }
  });
});
