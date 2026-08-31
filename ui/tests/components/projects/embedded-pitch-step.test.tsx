import { render, screen } from "@testing-library/react";
import { type ComponentType, createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  EmbeddedPitchDeckContent,
  EmbeddedPitchStep,
} from "@/components/projects/pitch-deck/embedded-pitch-deck-content";

const { markdownState } = vi.hoisted(() => ({
  markdownState: { props: undefined as Record<string, unknown> | undefined },
}));

vi.mock("@/components/markdown", () => ({
  MarkdownContent: (props: Record<string, unknown>) => {
    markdownState.props = props;
    return <div data-testid="embedded-markdown" />;
  },
}));

vi.mock("@/components/mermaid", () => ({
  Mermaid: () => <div>Mermaid</div>,
}));

describe("EmbeddedPitchStep", () => {
  it("uses Reveal fragment classes and keeps an explicit reveal order", () => {
    render(<EmbeddedPitchStep index={2}>Reconcile findings</EmbeddedPitchStep>);

    const step = screen.getByText("Reconcile findings");
    expect(step).toHaveClass("fragment", "fade-up", "pitch-step");
    expect(step).toHaveAttribute("data-fragment-index", "2");
  });

  it("registers native slide components and permits demo overrides", () => {
    const CustomDemo = () => <div>Interactive override</div>;
    render(
      <EmbeddedPitchDeckContent
        source="# Embedded"
        components={{ ReviewDepthDemo: CustomDemo }}
      />,
    );

    expect(screen.getByTestId("embedded-markdown")).toBeInTheDocument();
    expect(markdownState.props?.source).toBe("# Embedded");
    const components = markdownState.props?.components as Record<
      string,
      ComponentType<{ children?: React.ReactNode }>
    >;
    expect(components.ReviewDepthDemo).toBe(CustomDemo);
    expect(markdownState.props?.remarkPlugins).toHaveLength(1);
    const { PitchSlide, PitchColumns, PitchColumn, PitchNotes } = components;
    if (!PitchSlide || !PitchColumns || !PitchColumn || !PitchNotes) {
      throw new Error("Expected embedded pitch components to be registered");
    }

    const { container } = render(
      createElement(
        PitchSlide,
        null,
        createElement(
          PitchColumns,
          null,
          createElement(PitchColumn, null, "Column"),
        ),
        createElement(PitchNotes, null, "Notes"),
      ),
    );
    expect(container.querySelector("section.pitch-slide")).toBeInTheDocument();
    expect(container.querySelector(".pitch-columns")).toHaveTextContent(
      "Column",
    );
    expect(container.querySelector("aside.notes")).toHaveTextContent("Notes");
  });

  it("provides a static review-depth preview by default", () => {
    render(<EmbeddedPitchDeckContent source="# Preview" />);
    const components = markdownState.props?.components as Record<
      string,
      ComponentType
    >;
    const ReviewDepthDemo = components.ReviewDepthDemo;
    if (!ReviewDepthDemo) {
      throw new Error("Expected a static review-depth preview");
    }

    render(createElement(ReviewDepthDemo));
    expect(screen.getByText("Routine")).toBeInTheDocument();
    expect(screen.getByText("Material")).toBeInTheDocument();
    expect(screen.getByText("Sensitive")).toBeInTheDocument();
  });
});
