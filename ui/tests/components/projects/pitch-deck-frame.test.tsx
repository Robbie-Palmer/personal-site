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
    configure: vi.fn(),
    getPlugin: vi.fn(),
    getSlidePastCount: vi.fn(() => 0),
    getTotalSlides: vi.fn(() => 3),
    isFirstSlide: vi.fn(() => true),
    isLastSlide: vi.fn(() => false),
    isOverview: vi.fn(() => false),
    isScrollView: vi.fn(() => false),
    layout: vi.fn(),
    next: vi.fn(),
    prev: vi.fn(),
    slide: vi.fn(),
    toggleOverview: vi.fn(),
    toggleScrollView: vi.fn(),
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
        onReady?: (deck: typeof deckApi) => void;
      };
      deckState.props = props;
      React.useEffect(() => {
        onReady?.(deckApi);
        deckRef.current = deckApi;
      }, [deckRef, onReady]);
      return React.createElement("div", { "data-testid": "deck" }, children);
    },
  };
});

describe("PitchDeckFrame", () => {
  const requestFullscreen = vi.fn(() => Promise.resolve());
  const exitFullscreen = vi.fn(() => Promise.resolve());

  beforeEach(() => {
    vi.clearAllMocks();
    deckState.props = undefined;
    deckApi.getSlidePastCount.mockReturnValue(0);
    deckApi.getTotalSlides.mockReturnValue(3);
    deckApi.isFirstSlide.mockReturnValue(true);
    deckApi.isLastSlide.mockReturnValue(false);
    deckApi.isOverview.mockReturnValue(false);
    deckApi.isScrollView.mockReturnValue(false);
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      configurable: true,
      value: requestFullscreen,
    });
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: exitFullscreen,
    });
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: null,
    });
  });

  afterEach(() => {
    window.history.replaceState({}, "", "/");
    delete (HTMLElement.prototype as { requestFullscreen?: unknown })
      .requestFullscreen;
    delete (document as { exitFullscreen?: unknown }).exitFullscreen;
    delete (document as { fullscreenElement?: unknown }).fullscreenElement;
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

  it("keeps narrow layouts in the swipeable slide view", async () => {
    const matchMedia = vi.spyOn(window, "matchMedia").mockImplementation(
      (query): MediaQueryList => ({
        matches: query === "(max-width: 700px)",
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    );

    render(
      <PitchDeckFrame title="Mobile pitch" mode="focused">
        <section>Swipeable slide</section>
      </PitchDeckFrame>,
    );

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Scroll" })).toBeNull(),
    );
    expect(document.querySelector(".pitch-deck__static")).toBeNull();
    expect(document.querySelector(".pitch-deck__live")).not.toHaveAttribute(
      "hidden",
    );

    matchMedia.mockRestore();
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

    await waitFor(() =>
      expect(deckState.props?.config).toMatchObject({
        url: "/?fragments=false",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Overview" }));
    expect(screen.getByRole("button", { name: "Overview" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      document.querySelector(".pitch-deck__static--overview"),
    ).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open slide 2" }));
    expect(deckApi.slide).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByRole("button", { name: "Overview" }));

    const scrollButton = screen.getByRole("button", {
      name: "Scroll",
    });
    fireEvent.click(scrollButton);
    expect(scrollButton).toHaveAttribute("aria-pressed", "true");
    expect(
      document.querySelector(".pitch-deck__static--scroll"),
    ).not.toBeNull();
    expect(deckState.props?.config).toMatchObject({
      overview: false,
      scrollActivationWidth: 0,
      view: null,
    });

    deckApi.slide.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Next slide" }));
    fireEvent.click(scrollButton);
    await waitFor(() => expect(deckApi.slide).toHaveBeenCalledWith(2));

    fireEvent.click(screen.getByRole("button", { name: "Speaker" }));
    expect(openNotes).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Fullscreen" }));
    expect(requestFullscreen).toHaveBeenCalledOnce();

    const deckShell = screen.getByRole("region", {
      name: "reveal.js integration demo presentation",
    });
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: deckShell,
    });
    fireEvent(document, new Event("fullscreenchange"));
    await waitFor(() => expect(deckApi.layout).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "Exit fullscreen" }));
    expect(exitFullscreen).toHaveBeenCalledOnce();
    expect(screen.queryByRole("link", { name: "Transcript" })).toBeNull();
  });

  it("hides deck chrome inside speaker preview frames", async () => {
    window.history.replaceState({}, "", "/projects/demo/deck?receiver");

    render(
      <PitchDeckFrame projectSlug="demo" title="Speaker preview" mode="focused">
        <section>Preview slide</section>
      </PitchDeckFrame>,
    );

    await waitFor(() =>
      expect(document.querySelector(".pitch-deck__topbar")).toBeNull(),
    );
    expect(document.querySelector(".pitch-deck__controls")).toBeNull();
    expect(screen.queryByRole("button", { name: "Speaker" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Fullscreen" })).toBeNull();
  });

  it("adds focused project navigation and hash history", async () => {
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
    expect(screen.queryByRole("link", { name: "Print PDF" })).toBeNull();
    expect(deckState.props?.config).toMatchObject({
      embedded: true,
      hash: true,
      hashOneBasedIndex: true,
      history: true,
    });
  });
});
