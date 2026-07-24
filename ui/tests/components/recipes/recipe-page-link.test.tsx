import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: ReactNode;
    href: string;
  }) => (
    <a href={href} data-next-link="" {...props}>
      {children}
    </a>
  ),
}));

import {
  RecipeNavigationProvider,
  RecipePageLink,
} from "@/components/recipes/recipe-page-link";

function renderRecipeLink(ui: ReactNode) {
  return render(<RecipeNavigationProvider>{ui}</RecipeNavigationProvider>);
}

describe("RecipePageLink", () => {
  beforeEach(() => {
    navigation.push.mockClear();
  });

  it("keeps runtime recipe clicks in the client application", () => {
    renderRecipeLink(
      <RecipePageLink href="/recipes/weeknight-rice">
        Weeknight Rice
      </RecipePageLink>,
    );

    const link = screen.getByRole("link", { name: "Weeknight Rice" });
    expect(link).toHaveAttribute("href", "/recipes/weeknight-rice");
    expect(link).not.toHaveAttribute("data-next-link");
    fireEvent.click(link);
    expect(navigation.push).toHaveBeenCalledWith(
      "/recipes/saved?slug=weeknight-rice",
    );
  });

  it("decodes an encoded runtime slug for client navigation", () => {
    renderRecipeLink(
      <RecipePageLink href="/recipes/weeknight%20rice">
        Weeknight Rice
      </RecipePageLink>,
    );

    const link = screen.getByRole("link", { name: "Weeknight Rice" });
    expect(link).toHaveAttribute("href", "/recipes/weeknight%20rice");
    expect(link).not.toHaveAttribute("data-next-link");
    fireEvent.click(link);
    expect(navigation.push).toHaveBeenCalledWith(
      "/recipes/saved?slug=weeknight%20rice",
    );
  });

  it("leaves modified clicks as canonical document navigations", () => {
    renderRecipeLink(
      <RecipePageLink href="/recipes/weeknight-rice">
        Weeknight Rice
      </RecipePageLink>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Weeknight Rice" }), {
      ctrlKey: true,
    });

    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("falls back to document navigation without a navigation provider", () => {
    render(
      <RecipePageLink href="/recipes/weeknight-rice">
        Weeknight Rice
      </RecipePageLink>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Weeknight Rice" }));

    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("keeps static application routes on Next client navigation", () => {
    renderRecipeLink(
      <RecipePageLink href="/recipes/discover">Discover</RecipePageLink>,
    );

    const link = screen.getByRole("link", { name: "Discover" });
    expect(link).toHaveAttribute("href", "/recipes/discover");
    expect(link).toHaveAttribute("data-next-link");
  });
});
