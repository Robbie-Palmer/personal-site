import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewDepthDemo } from "@/components/projects/pitch-deck/review-depth-demo";

describe("ReviewDepthDemo", () => {
  it("updates the reviewer count and explanation for each risk level", () => {
    render(<ReviewDepthDemo />);

    expect(screen.getByRole("button", { name: "Material" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Routine" }));
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(
      screen.getByText("One fast pass over the changed files."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sensitive" }));
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(
      screen.getByText("Security, correctness, and repository-policy passes."),
    ).toBeInTheDocument();
  });
});
