import { act, render, screen } from "@testing-library/react";
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

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Time's up for roast vegetables.",
    );

    const expandButton = screen.getByRole("button", {
      name: "Time's up for roast vegetables. Expand cooking timers (1)",
    });
    expect(expandButton).toHaveTextContent("time's up!");
    expect(expandButton.parentElement).toHaveClass(
      "rt-timer-attention",
      "bg-[var(--berry)]",
    );
    expect(expandButton.parentElement).not.toHaveClass("animate-pulse");
  });
});
