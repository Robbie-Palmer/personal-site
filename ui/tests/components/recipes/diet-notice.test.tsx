import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DietListNotice } from "@/components/recipes/diet-notice";

describe("DietListNotice", () => {
  it("summarises long diet label lists instead of rendering every exclusion", () => {
    render(
      <DietListNotice
        hiddenCount={48}
        labels={[
          "Vegan",
          "Gluten-free",
          "Low-FODMAP review",
          "no Chilli",
          "no Alcohol",
        ]}
        mode="hide"
        showingHidden={false}
      />,
    );

    expect(screen.getByText(/Vegan, Gluten-free \+3 more/)).toBeInTheDocument();
    expect(screen.queryByText(/Low-FODMAP/)).toBeNull();
    expect(screen.getByText(/48 recipes hidden/)).toBeInTheDocument();
  });
});
