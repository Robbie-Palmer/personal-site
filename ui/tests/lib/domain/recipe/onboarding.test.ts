import { describe, expect, it } from "vitest";
import {
  buildRecipeAuthoringHref,
  resolveOnboardingRecipeSelection,
} from "@/lib/domain/recipe/onboarding";

describe("recipe onboarding navigation", () => {
  const available = new Set(["lentil-soup", "chickpea-stew", "pasta"]);

  it("carries the current starter choices through recipe authoring", () => {
    const href = buildRecipeAuthoringHref([
      "lentil-soup",
      "chickpea-stew",
      "lentil-soup",
    ]);
    const addURL = new URL(href, "https://recipes.example.test");
    const returnTo = addURL.searchParams.get("returnTo");

    expect(returnTo).toBe(
      "/recipes/onboarding?step=box&draft=1&selected=lentil-soup&selected=chickpea-stew",
    );
    expect(
      resolveOnboardingRecipeSelection(returnTo ?? "", [], available),
    ).toEqual(["lentil-soup", "chickpea-stew"]);
  });

  it("restores an intentionally empty draft instead of persisted choices", () => {
    expect(
      resolveOnboardingRecipeSelection(
        "/recipes/onboarding?step=box&draft=1",
        ["pasta"],
        available,
      ),
    ).toEqual([]);
  });

  it("uses persisted choices without a returned draft and rejects unknown slugs", () => {
    expect(
      resolveOnboardingRecipeSelection(
        "?step=box",
        ["pasta", "not-in-the-static-catalog"],
        available,
      ),
    ).toEqual(["pasta"]);
  });
});
