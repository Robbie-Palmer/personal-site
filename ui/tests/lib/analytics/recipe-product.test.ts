import posthog from "posthog-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  captureRecipeEvent,
  captureRecipeProductActivity,
  captureRecipeValue,
  recipeAnalyticsEnvironment,
} from "@/lib/analytics/recipe-product";

vi.mock("posthog-js", () => ({
  default: {
    capture: vi.fn(),
  },
}));

describe("recipe product analytics", () => {
  beforeEach(() => {
    vi.mocked(posthog.capture).mockReset();
  });

  it("marks local events as development traffic", () => {
    expect(recipeAnalyticsEnvironment("localhost")).toBe("development");

    captureRecipeProductActivity("cook_mode_started", {
      recipe_slug: "weeknight-pasta",
    });

    expect(posthog.capture).toHaveBeenCalledWith("recipe_product_used", {
      activity: "cook_mode_started",
      app_area: "recipes",
      environment: "development",
      recipe_slug: "weeknight-pasta",
    });
  });

  it("adds the common recipe dimensions to dedicated events", () => {
    captureRecipeEvent("recipe_onboarding_completed", {
      recipe_box_size: 3,
    });

    expect(posthog.capture).toHaveBeenCalledWith(
      "recipe_onboarding_completed",
      {
        app_area: "recipes",
        environment: "development",
        recipe_box_size: 3,
      },
    );
  });

  it("records a value moment as both an outcome and meaningful usage", () => {
    captureRecipeValue("recipe_cooked", {
      recipe_slug: "weeknight-pasta",
    });

    expect(posthog.capture).toHaveBeenNthCalledWith(1, "recipe_value_reached", {
      app_area: "recipes",
      environment: "development",
      recipe_slug: "weeknight-pasta",
      value_moment: "recipe_cooked",
    });
    expect(posthog.capture).toHaveBeenNthCalledWith(2, "recipe_product_used", {
      activity: "recipe_cooked",
      app_area: "recipes",
      environment: "development",
      recipe_slug: "weeknight-pasta",
    });
  });
});
