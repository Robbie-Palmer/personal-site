import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TimerDock } from "@/components/recipes/timer-dock";
import { CookModeProvider } from "@/contexts/cook-mode-context";
import {
  __resetTimerStoreForTests,
  startTimer,
} from "@/lib/cooking/timerStore";

describe("TimerDock", () => {
  beforeEach(() => {
    localStorage.clear();
    __resetTimerStoreForTests();
  });

  afterEach(() => {
    __resetTimerStoreForTests();
    vi.useRealTimers();
  });

  it("announces a timer that was already complete when the dock mounts", () => {
    vi.useFakeTimers();
    startTimer({
      id: "restored-timer",
      label: "restored timer",
      durationSeconds: 1,
    });
    vi.advanceTimersByTime(1_000);

    render(
      <CookModeProvider>
        <TimerDock />
      </CookModeProvider>,
    );

    expect(screen.getByRole("alert")).toBeEmptyDOMElement();
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Time's up for restored timer.",
    );
  });

  it("turns a completed timer into a persistent, accessible alert", () => {
    vi.useFakeTimers();
    startTimer({
      id: "roast-timer",
      recipeSlug: "roast-vegetables",
      recipeTitle: "Roast vegetables",
      label: "roast vegetables",
      stepIndex: 1,
      stepText: "Roast until golden",
      durationSeconds: 1,
    });

    render(
      <CookModeProvider>
        <TimerDock />
      </CookModeProvider>,
    );

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Time's up for roast vegetables.",
    );

    const expandButton = screen.getByRole("button", {
      name: "Time's up for roast vegetables. Expand cooking timers (1)",
    });
    expect(expandButton).toHaveTextContent("time's up!");
    expect(expandButton.parentElement).toHaveClass("bg-[var(--berry)]");
    const firstAttentionCue = expandButton.closest(".rt-timer-attention");
    expect(firstAttentionCue).not.toBeNull();
    expect(firstAttentionCue).not.toHaveClass("animate-pulse");

    fireEvent.click(expandButton);
    expect(document.querySelector(".rt-timer-attention")).toBe(
      firstAttentionCue,
    );

    act(() => {
      startTimer({
        id: "sauce-timer",
        label: "sauce",
        durationSeconds: 1,
      });
    });
    act(() => {
      vi.advanceTimersByTime(1_250);
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(document.querySelector(".rt-timer-attention")).not.toBe(
      firstAttentionCue,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "2 cooking timers are complete.",
    );
  });
});
