import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

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

import { RecipePageLink } from "@/components/recipes/recipe-page-link";

describe("RecipePageLink", () => {
  it("uses a document navigation for runtime public recipe pages", () => {
    render(
      <RecipePageLink href="/recipes/weeknight-rice">
        Weeknight Rice
      </RecipePageLink>,
    );

    const link = screen.getByRole("link", { name: "Weeknight Rice" });
    expect(link).toHaveAttribute("href", "/recipes/weeknight-rice");
    expect(link).not.toHaveAttribute("data-next-link");
  });

  it("keeps static application routes on Next client navigation", () => {
    render(<RecipePageLink href="/recipes/discover">Discover</RecipePageLink>);

    const link = screen.getByRole("link", { name: "Discover" });
    expect(link).toHaveAttribute("href", "/recipes/discover");
    expect(link).toHaveAttribute("data-next-link");
  });
});
