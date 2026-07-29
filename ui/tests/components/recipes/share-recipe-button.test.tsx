import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShareRecipeButton } from "@/components/recipes/share-recipe-button";

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("sonner", () => ({ toast }));

describe("ShareRecipeButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("uses the native share sheet when available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: share,
    });
    render(
      <ShareRecipeButton
        recipeSlug="weekday-stew"
        recipeTitle="Weekday Stew"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Share" }));

    expect(share).toHaveBeenCalledWith({
      title: "Weekday Stew",
      url: "http://localhost:3000/recipes/weekday-stew",
    });
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });

  it("copies the recipe link when native sharing is unavailable", async () => {
    render(
      <ShareRecipeButton
        recipeSlug="weekday-stew"
        recipeTitle="Weekday Stew"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Share" }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "http://localhost:3000/recipes/weekday-stew",
    );
    expect(toast.success).toHaveBeenCalledWith("Recipe link copied");
  });
});
