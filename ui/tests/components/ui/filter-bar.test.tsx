import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import {
  FilterBar,
  type MobileFilterSection,
} from "@/components/ui/filter-bar";
import { type FilterState, nextFilterState } from "@/hooks/use-filter-params";

function StatefulFilterBar() {
  const [states, setStates] = useState<Record<string, FilterState>>({
    alpha: "include",
  });
  const mobileFilterSections: MobileFilterSection[] = [
    {
      paramName: "ingredient",
      label: "Ingredients",
      options: [
        { value: "alpha", label: "Alpha" },
        { value: "beta", label: "Beta" },
        { value: "gamma", label: "Gamma" },
      ],
      getOptionState: (value) => states[value] ?? "off",
      onCycleOption: (value) =>
        setStates((current) => ({
          ...current,
          [value]: nextFilterState(current[value] ?? "off"),
        })),
    },
  ];

  return (
    <FilterBar mobileFilterSections={mobileFilterSections}>
      <span>Desktop filters</span>
    </FilterBar>
  );
}

describe("FilterBar", () => {
  it("keeps option positions stable while filter states change", () => {
    render(<StatefulFilterBar />);

    // Vaul's pointer-capture gesture handling is not implemented by jsdom.
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Ingredients, 3 values, 1 active",
      }),
    );

    const search = screen.getByRole("searchbox", {
      name: "Search Ingredients filter values",
    });
    const options = within(
      document.getElementById(search.getAttribute("aria-controls") ?? "") ??
        document.body,
    );
    expect(
      options
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Alpha (included)", "Beta", "Gamma"]);

    fireEvent.click(options.getByRole("button", { name: "Gamma" }));

    expect(
      options
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Alpha (included)", "Beta", "Gamma (included)"]);
  });

  it("falls back to the supplied mobile controls without rendering zero", () => {
    render(
      <FilterBar mobileFilterSections={[]}>
        <span>Fallback controls</span>
      </FilterBar>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Filters" }));

    const drawer = screen.getByRole("dialog");
    expect(within(drawer).getByText("Fallback controls")).toBeInTheDocument();
    expect(
      Array.from(drawer.childNodes).some((node) => node.textContent === "0"),
    ).toBe(false);
  });
});
