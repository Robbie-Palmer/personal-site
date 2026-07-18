import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InlineTimer } from "@/components/recipes/inline-timer";
import { useCookingTimer } from "@/hooks/use-cooking-timers";
import {
  dismissTimer,
  pauseTimer,
  resumeTimer,
  startTimer,
} from "@/lib/cooking/timerStore";

vi.mock("@/hooks/use-cooking-timers", () => ({
  useCookingTimer: vi.fn(),
}));

vi.mock("@/lib/cooking/timerStore", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/cooking/timerStore")>();
  return {
    ...original,
    dismissTimer: vi.fn(),
    pauseTimer: vi.fn(),
    resumeTimer: vi.fn(),
    startTimer: vi.fn(),
  };
});

const mockUseCookingTimer = vi.mocked(useCookingTimer);

const props = {
  timerId: "timer-1",
  recipeSlug: "soup",
  recipeTitle: "Soup",
  stepIndex: 2,
  stepText: "Simmer gently",
  durationSeconds: 300,
  label: "5 minutes",
};

describe("InlineTimer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCookingTimer.mockReturnValue(undefined);
  });

  it("starts an idle timer with its recipe context", async () => {
    const user = userEvent.setup();
    render(<InlineTimer {...props} />);

    await user.click(
      screen.getByRole("button", { name: "Start 5 minutes timer" }),
    );

    expect(startTimer).toHaveBeenCalledWith({
      id: "timer-1",
      recipeSlug: "soup",
      recipeTitle: "Soup",
      stepIndex: 2,
      stepText: "Simmer gently",
      durationSeconds: 300,
      label: "5 minutes",
    });
  });

  it.each([
    ["running", "Pause timer, 2:00 remaining", pauseTimer],
    ["paused", "Resume timer, 2:00 remaining", resumeTimer],
    ["completed", "Timer complete, click to dismiss", dismissTimer],
  ] as const)("routes the %s action", async (state, accessibleName, action) => {
    const user = userEvent.setup();
    mockUseCookingTimer.mockReturnValue({
      id: "timer-1",
      label: "5 minutes",
      durationSeconds: 300,
      endTimeMs: null,
      remainingSeconds: 120,
      state,
    });

    render(<InlineTimer {...props} />);
    await user.click(screen.getByRole("button", { name: accessibleName }));

    expect(action).toHaveBeenCalledWith("timer-1");
  });
});
