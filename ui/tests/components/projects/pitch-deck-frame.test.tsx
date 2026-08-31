import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PitchDeckFrame } from "@/components/projects/pitch-deck/pitch-deck-frame";

const { deckApi, deckState } = vi.hoisted(() => ({
  deckApi: {
    getPlugin: vi.fn(),
    getSlidePastCount: vi.fn(() => 0),
    getTotalSlides: vi.fn(() => 3),
    isFirstSlide: vi.fn(() => true),
    isLastSlide: vi.fn(() => false),
    next: vi.fn(),
    prev: vi.fn(),
    toggleOverview: vi.fn(),
  },
  deckState: { props: undefined as Record<string, unknown> | undefined },
}));

vi.mock("@revealjs/react", async () => {
  const React = await import("react");
  return {
    Deck: (props: Record<string, unknown>) => {
      const { children, deckRef, onReady } = props as {
        children: React.ReactNode;
        deckRef: React.MutableRefObject<unknown>;
        onReady?: () => void;
      };
      deckState.props = props;
      React.useEffect(() => {
        deckRef.current = deckApi;
        onReady?.();
      }, [deckRef, onReady]);
      return React.createElement("div", { "data-testid": "deck" }, children);
    },
  };
});

describe("PitchDeckFrame", () => {
  const requestFullscreen = vi.fn(() => Promise.resolve());

  beforeEach(() => {
    vi.clearAllMocks();
    deckState.props = undefined;
    deckApi.getSlidePastCount.mockReturnValue(0);
    deckApi.getTotalSlides.mockReturnValue(3);
    deckApi.isFirstSlide.mockReturnValue(true);
    deckApi.isLastSlide.mockReturnValue(false);
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      configurable: true,
      value: requestFullscreen,
    });
  });

  afterEach(() => {
    delete (HTMLElement.prototype as { requestFullscreen?: unknown })
      .requestFullscreen;
  });

  it("navigates an embedded project deck and exposes its reading routes", async () => {
    render(
      <PitchDeckFrame
        projectSlug="agentic-code-review"
        title="Agentic Code Review pitch"
        mode="embedded"
      >
        <section>Slide content</section>
      </PitchDeckFrame>,
    );

    await waitFor(() =>
      expect(screen.getByText("Slide 1 of 3")).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: "Previous slide" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next slide" }));
    expect(deckApi.next).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "Transcript" })).toHaveAttribute(
      "href",
      "/projects/agentic-code-review/deck.md",
    );
    expect(screen.getByRole("link", { name: "Open deck" })).toHaveAttribute(
      "href",
      "/projects/agentic-code-review/deck",
    );
    expect(deckState.props?.config).toMatchObject({
      embedded: true,
      hash: false,
      keyboardCondition: "focused",
    });

    deckApi.getSlidePastCount.mockReturnValue(1);
    deckApi.isFirstSlide.mockReturnValue(false);
    act(() => {
      (deckState.props?.onSlideChange as (() => void) | undefined)?.();
    });
    expect(screen.getByText("Slide 2 of 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Previous slide" }));
    expect(deckApi.prev).toHaveBeenCalledOnce();
  });

  it("runs presenter tools without requiring project-specific links", async () => {
    const openNotes = vi.fn();
    deckApi.getPlugin.mockReturnValue({ open: openNotes });

    render(
      <PitchDeckFrame
        title="reveal.js integration demo"
        mode="embedded"
        showPresenterTools
      >
        <section>Demo slide</section>
      </PitchDeckFrame>,
    );

    await waitFor(() => expect(deckState.props).toBeDefined());
    fireEvent.click(screen.getByRole("button", { name: "Overview" }));
    expect(deckApi.toggleOverview).toHaveBeenCalledOnce();

    const scrollButton = screen.getByRole("button", {
      name: "Scroll",
    });
    fireEvent.click(scrollButton);
    expect(scrollButton).toHaveAttribute("aria-pressed", "true");
    expect(deckState.props?.config).toMatchObject({ view: "scroll" });

    fireEvent.click(screen.getByRole("button", { name: "Speaker" }));
    expect(openNotes).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Fullscreen" }));
    expect(requestFullscreen).toHaveBeenCalledOnce();
    expect(screen.queryByRole("link", { name: "Transcript" })).toBeNull();
  });

  it("adds focused project navigation, print, and hash history", async () => {
    render(
      <PitchDeckFrame
        projectSlug="agentic-code-review"
        title="Agentic Code Review pitch"
        mode="focused"
      >
        <section>Focused slide</section>
      </PitchDeckFrame>,
    );

    await waitFor(() => expect(deckState.props).toBeDefined());
    expect(
      screen.getByRole("link", { name: "Back to project" }),
    ).toHaveAttribute("href", "/projects/agentic-code-review");
    expect(screen.getByRole("link", { name: "Print PDF" })).toHaveAttribute(
      "href",
      "/projects/agentic-code-review/deck?print-pdf",
    );
    expect(deckState.props?.config).toMatchObject({
      embedded: false,
      hash: true,
      hashOneBasedIndex: true,
      history: true,
    });
  });
});
