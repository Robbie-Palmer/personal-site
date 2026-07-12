import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  DietListNotice,
  DietLoadErrorNotice,
  DietWarning,
} from "@/components/recipes/diet-notice";

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

  it("shows a toggle only for hidden recipes", async () => {
    const user = userEvent.setup();
    const onToggleHidden = vi.fn();
    const { rerender } = render(
      <DietListNotice
        hiddenCount={2}
        labels={["Vegan"]}
        mode="hide"
        showingHidden={false}
        onToggleHidden={onToggleHidden}
      />,
    );

    await user.click(screen.getByRole("button", { name: "show anyway" }));
    expect(onToggleHidden).toHaveBeenCalledOnce();

    rerender(
      <DietListNotice
        hiddenCount={2}
        labels={["Vegan"]}
        mode="warn"
        showingHidden={false}
        onToggleHidden={onToggleHidden}
      />,
    );
    expect(
      screen.getByText(/Recipes that don't match are marked with a warning/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "show anyway" })).toBeNull();
  });
});

describe("DietWarning", () => {
  it("renders excluded ingredient names in an output", () => {
    render(
      <DietWarning
        match={{
          matches: false,
          excludedIngredients: [
            { slug: "bacon", name: "Bacon" },
            { slug: "milk", name: "Milk" },
          ],
        }}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      /Doesn't match your diet: Bacon, Milk/,
    );
  });

  it("renders nothing for a match and supports compact warnings", () => {
    const { container, rerender } = render(
      <DietWarning match={{ matches: true, excludedIngredients: [] }} />,
    );
    expect(container.firstChild).toBeNull();

    rerender(
      <DietWarning
        compact
        match={{
          matches: false,
          excludedIngredients: [{ slug: "egg", name: "Egg" }],
        }}
      />,
    );
    expect(container.querySelector("output")).toHaveClass("text-xs");
  });
});

describe("DietLoadErrorNotice", () => {
  it("warns that filtering cannot be relied on", () => {
    render(<DietLoadErrorNotice />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      /Diet preferences are unavailable/,
    );
  });
});
