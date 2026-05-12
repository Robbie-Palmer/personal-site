import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecipePagination } from "@/components/recipes/recipe-pagination";
import type { RecipeCardView } from "@/lib/api/recipes";

function makeRecipe(slug: string, title: string): RecipeCardView {
  return {
    slug,
    title,
    description: "Test recipe",
    date: "2026-02-10",
    cuisine: [],
    servings: 4,
    ingredientNames: [],
    cookware: [],
  };
}

describe("RecipePagination", () => {
  it("renders previous and next recipe links when both neighbors exist", () => {
    render(
      <RecipePagination
        prevRecipe={makeRecipe("previous-recipe", "Previous Recipe")}
        nextRecipe={makeRecipe("next-recipe", "Next Recipe")}
      />,
    );

    expect(
      screen.getByRole("link", { name: /previous previous recipe/i }),
    ).toHaveAttribute("href", "/recipes/previous-recipe");
    expect(
      screen.getByRole("link", { name: /next next recipe/i }),
    ).toHaveAttribute("href", "/recipes/next-recipe");
  });

  it("renders only the available navigation control at the start of the list", () => {
    render(
      <RecipePagination
        nextRecipe={makeRecipe("next-recipe", "Next Recipe")}
      />,
    );

    expect(
      screen.queryByRole("link", { name: /previous/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /next next recipe/i }),
    ).toBeInTheDocument();
  });

  it("renders only the available navigation control at the end of the list", () => {
    render(
      <RecipePagination
        prevRecipe={makeRecipe("previous-recipe", "Previous Recipe")}
      />,
    );

    expect(
      screen.getByRole("link", { name: /previous previous recipe/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /next/i }),
    ).not.toBeInTheDocument();
  });

  it("renders nothing when there are no neighbors", () => {
    const { container } = render(<RecipePagination />);

    expect(container).toBeEmptyDOMElement();
  });
});
