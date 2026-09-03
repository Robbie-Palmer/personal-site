import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PitchDeckPresenter } from "@/components/projects/pitch-deck/pitch-deck-presenter";

const presenterMessage = {
  namespace: "pitch-deck-presenter",
  type: "state",
  current: 3,
  total: 8,
  notes: "Explain why the review loop belongs to the team.",
};

describe("PitchDeckPresenter", () => {
  const opener = { postMessage: vi.fn() } as unknown as Window;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "opener", {
      configurable: true,
      value: opener,
    });
    window.history.replaceState({}, "", "/projects/demo/deck/presenter#/3");
  });

  afterEach(() => {
    window.history.replaceState({}, "", "/");
    Object.defineProperty(window, "opener", {
      configurable: true,
      value: null,
    });
  });

  it("renders the hash slide and reconnects to its opener", () => {
    const { unmount } = render(
      <PitchDeckPresenter deckHref="/projects/demo/deck" title="Demo deck" />,
    );

    expect(screen.getByTitle("Current slide")).toHaveAttribute(
      "src",
      expect.stringContaining("#/3"),
    );
    expect(screen.getByTitle("Next slide")).toHaveAttribute(
      "src",
      expect.stringContaining("#/4"),
    );
    expect(screen.getByText("3 / –")).toBeInTheDocument();
    expect(
      screen.getByText("No speaker notes for this slide."),
    ).toBeInTheDocument();
    expect(opener.postMessage).toHaveBeenCalledWith(
      { namespace: "pitch-deck-presenter", type: "connect" },
      window.location.origin,
    );

    fireEvent.load(screen.getByTitle("Current slide"));
    fireEvent.load(screen.getByTitle("Next slide"));
    unmount();
  });

  it("updates previews and sends button and keyboard navigation", () => {
    render(
      <PitchDeckPresenter deckHref="/projects/demo/deck" title="Demo deck" />,
    );

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: presenterMessage,
          origin: window.location.origin,
          source: opener,
        }),
      );
    });

    expect(window.location.hash).toBe("#/4");
    expect(screen.getByText("4 / 8")).toBeInTheDocument();
    expect(screen.getByText(presenterMessage.notes)).toBeInTheDocument();
    expect(screen.getByTitle("Current slide")).toHaveAttribute(
      "src",
      expect.stringContaining("#/4"),
    );
    expect(screen.getByTitle("Next slide")).toHaveAttribute(
      "src",
      expect.stringContaining("#/5"),
    );

    opener.postMessage = vi.fn();
    fireEvent.click(screen.getByRole("button", { name: "Previous slide" }));
    fireEvent.click(screen.getByRole("button", { name: "Next slide" }));
    fireEvent.keyDown(window, { key: "PageUp" });
    fireEvent.keyDown(window, { key: " " });
    fireEvent.keyDown(window, { key: "Escape" });

    expect(opener.postMessage).toHaveBeenCalledTimes(4);
    expect(opener.postMessage).toHaveBeenNthCalledWith(
      1,
      {
        namespace: "pitch-deck-presenter",
        type: "navigate",
        direction: "previous",
      },
      window.location.origin,
    );
    expect(opener.postMessage).toHaveBeenNthCalledWith(
      2,
      {
        namespace: "pitch-deck-presenter",
        type: "navigate",
        direction: "next",
      },
      window.location.origin,
    );
  });

  it("ignores foreign messages and clamps the next preview at the end", () => {
    render(
      <PitchDeckPresenter deckHref="/projects/demo/deck" title="Demo deck" />,
    );

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: presenterMessage,
          origin: "https://example.com",
          source: opener,
        }),
      );
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { ...presenterMessage, current: 7, notes: "" },
          origin: window.location.origin,
          source: opener,
        }),
      );
    });

    expect(window.location.hash).toBe("#/8");
    expect(screen.getByTitle("Current slide")).toHaveAttribute(
      "src",
      expect.stringContaining("#/8"),
    );
    expect(screen.getByTitle("Next slide")).toHaveAttribute(
      "src",
      expect.stringContaining("#/8"),
    );
    expect(screen.getByRole("button", { name: "Next slide" })).toBeDisabled();
    expect(
      screen.getByText("No speaker notes for this slide."),
    ).toBeInTheDocument();
  });
});
