import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecipeList } from "@/components/recipes/recipe-list";
import type { RecipeCardView } from "@/lib/api/recipes";

const replaceMock = vi.fn();

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

const recipes: RecipeCardView[] = [
  {
    slug: "slow-cooker-mexican-chicken",
    title: "Slow Cooker Mexican Chicken",
    description: "Slow cooker chicken for tacos.",
    date: "2026-02-12",
    cuisine: ["Mexican"],
    servings: 4,
    prepTime: 15,
    cookTime: 240,
    totalTime: 255,
    ingredientNames: ["chicken breast", "white onion"],
    cookware: ["fork", "oven", "slow cooker"],
  },
  {
    slug: "chicken-quesadillas",
    title: "Chicken Quesadillas",
    description: "Crisp quesadillas with chipotle mayo.",
    date: "2026-02-10",
    cuisine: ["Mexican"],
    servings: 4,
    prepTime: 20,
    cookTime: 30,
    totalTime: 50,
    ingredientNames: ["chicken breast", "cheddar cheese"],
    cookware: ["baking tray", "bowl", "fork", "frying pan", "oven", "spoon"],
  },
  {
    slug: "creamy-pesto-risotto",
    title: "Creamy Pesto Risotto",
    description: "Creamy risotto with pesto.",
    date: "2026-02-08",
    cuisine: ["Italian"],
    servings: 4,
    prepTime: 10,
    cookTime: 30,
    totalTime: 40,
    ingredientNames: ["arborio rice", "pesto"],
    cookware: ["bowl", "saucepan"],
  },
];

describe("RecipeList", () => {
  beforeEach(() => {
    currentSearchParams = new URLSearchParams();
    replaceMock.mockReset();
  });

  it("shows an equipment filter with cookware options", async () => {
    const user = userEvent.setup();

    render(<RecipeList recipes={recipes} />);

    const equipmentLabel = screen.getByText("Equipment:");
    const equipmentFilter = equipmentLabel.closest('[role="combobox"]');
    expect(equipmentFilter).not.toBeNull();

    await user.click(equipmentFilter!);

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
});
