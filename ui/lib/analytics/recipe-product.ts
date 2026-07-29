import posthog from "posthog-js";
import { isPreviewDeployment } from "@/lib/preview-environment";

export const RECIPE_PRODUCT_EVENT = "recipe_product_used";

export type RecipeProductActivity =
  | "cook_mode_started"
  | "kitchen_ingredient_added"
  | "meal_planned"
  | "onboarding_completed"
  | "recipe_viewed"
  | "shopping_item_checked"
  | "shopping_recipe_added"
  | "timer_started";

type RecipeAnalyticsProperties = Record<
  string,
  boolean | number | string | null | undefined
>;

export function recipeAnalyticsEnvironment(
  hostname = globalThis.location?.hostname,
): "development" | "preview" | "production" {
  if (process.env.NODE_ENV !== "production") return "development";
  return hostname && isPreviewDeployment(hostname) ? "preview" : "production";
}

function baseProperties(): RecipeAnalyticsProperties {
  return {
    app_area: "recipes",
    environment: recipeAnalyticsEnvironment(),
  };
}

export function captureRecipeEvent(
  event: string,
  properties: RecipeAnalyticsProperties = {},
): void {
  posthog.capture(event, { ...baseProperties(), ...properties });
}

export function captureRecipeProductActivity(
  activity: RecipeProductActivity,
  properties: RecipeAnalyticsProperties = {},
): void {
  captureRecipeEvent(RECIPE_PRODUCT_EVENT, { activity, ...properties });
}
