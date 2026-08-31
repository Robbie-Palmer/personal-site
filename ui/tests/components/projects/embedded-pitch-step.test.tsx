import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmbeddedPitchStep } from "@/components/projects/pitch-deck/embedded-pitch-deck-content";

describe("EmbeddedPitchStep", () => {
  it("uses Reveal fragment classes and keeps an explicit reveal order", () => {
    render(<EmbeddedPitchStep index={2}>Reconcile findings</EmbeddedPitchStep>);

    const step = screen.getByText("Reconcile findings");
    expect(step).toHaveClass("fragment", "fade-up", "pitch-step");
    expect(step).toHaveAttribute("data-fragment-index", "2");
  });
});
