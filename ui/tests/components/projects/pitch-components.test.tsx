import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  PitchColumn,
  PitchColumns,
  PitchNotes,
  PitchSlide,
  PitchStep,
} from "@/components/projects/pitch-deck/pitch-components";
import { PitchDeckContent } from "@/components/projects/pitch-deck/pitch-deck-content";

const { markdownState } = vi.hoisted(() => ({
  markdownState: { props: undefined as Record<string, unknown> | undefined },
}));

vi.mock("@revealjs/react", () => ({
  Fragment: ({
    animation,
    children,
    className,
    index,
  }: {
    animation: string;
    children: React.ReactNode;
    className: string;
    index?: number;
  }) => (
    <div
      className={className}
      data-animation={animation}
      data-fragment-index={index}
    >
      {children}
    </div>
  ),
  Slide: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className: string;
  }) => <section className={className}>{children}</section>,
}));

vi.mock("@/components/markdown", () => ({
  MarkdownContent: (props: Record<string, unknown>) => {
    markdownState.props = props;
    return <div data-testid="markdown-content" />;
  },
}));

vi.mock("@/components/mermaid", () => ({
  Mermaid: () => <div>Mermaid</div>,
}));

describe("pitch MDX components", () => {
  it("maps slides, notes, columns, and ordered fragments to Reveal markup", () => {
    const { container } = render(
      <PitchSlide className="custom-slide">
        <PitchColumns>
          <PitchColumn>Left</PitchColumn>
          <PitchColumn>Right</PitchColumn>
        </PitchColumns>
        <PitchStep index={2}>Later</PitchStep>
        <PitchNotes>Presenter only</PitchNotes>
      </PitchSlide>,
    );

    expect(container.querySelector("section")).toHaveClass(
      "pitch-slide",
      "custom-slide",
    );
    expect(container.querySelector(".pitch-columns")).toHaveTextContent(
      "LeftRight",
    );
    expect(container.querySelectorAll(".pitch-column")).toHaveLength(2);
    expect(screen.getByText("Later")).toHaveAttribute(
      "data-animation",
      "fade-up",
    );
    expect(screen.getByText("Later")).toHaveAttribute(
      "data-fragment-index",
      "2",
    );
    expect(container.querySelector("aside.notes")).toHaveTextContent(
      "Presenter only",
    );
  });

  it("registers the full component set with the pitch slide plugin", () => {
    render(<PitchDeckContent source="# Opening" />);

    expect(screen.getByTestId("markdown-content")).toBeInTheDocument();
    expect(markdownState.props?.source).toBe("# Opening");
    expect(
      Object.keys(markdownState.props?.components as object).sort(),
    ).toEqual([
      "Mermaid",
      "PitchColumn",
      "PitchColumns",
      "PitchNotes",
      "PitchSlide",
      "PitchStep",
      "ReviewDepthDemo",
      "TechIcon",
    ]);
    expect(markdownState.props?.remarkPlugins).toHaveLength(1);
  });
});
