import { describe, expect, it } from "vitest";
import { RecipeQueryStatus } from "@/components/recipes/recipe-load-state";
import { render, screen } from "@/tests/test-utils";

describe("RecipeQueryStatus", () => {
  it("reports an initial load error without presenting it as empty data", () => {
    render(
      <RecipeQueryStatus
        error={new Error("offline")}
        hasData={false}
        isFetching={false}
        isStale
        subject="public recipes"
      />,
    );

    expect(
      screen.getByText("Public recipes could not be loaded."),
    ).toBeInTheDocument();
  });

  it("keeps cached data visible when a background refresh fails", () => {
    render(
      <RecipeQueryStatus
        error={new Error("offline")}
        hasData
        isFetching={false}
        isStale
        subject="your recipe box"
      />,
    );

    expect(
      screen.getByText(
        "The latest refresh failed; cached data for your recipe box is still shown.",
      ),
    ).toBeInTheDocument();
  });

  it("announces background refreshes", () => {
    render(
      <RecipeQueryStatus
        error={null}
        hasData
        isFetching
        isStale
        subject="your kitchen"
      />,
    );

    expect(screen.getByText("Refreshing your kitchen…")).toBeInTheDocument();
  });

  it("identifies stale data between refreshes", () => {
    render(
      <RecipeQueryStatus
        error={null}
        hasData
        isFetching={false}
        isStale
        subject="this recipe"
      />,
    );

    expect(
      screen.getByText(
        "Cached data for this recipe is shown; updates will refresh in the background.",
      ),
    ).toBeInTheDocument();
  });

  it("stays quiet while current data is idle", () => {
    const view = render(
      <RecipeQueryStatus
        error={null}
        hasData
        isFetching={false}
        isStale={false}
        subject="this recipe"
      />,
    );

    expect(view.container).toBeEmptyDOMElement();
  });
});
