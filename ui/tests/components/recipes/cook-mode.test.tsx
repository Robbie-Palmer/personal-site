import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CookMode, type CookStep } from "@/components/recipes/cook-mode";
import { CookModeProvider, useCookMode } from "@/contexts/cook-mode-context";
import { useCookingTimer } from "@/hooks/use-cooking-timers";
import { startTimer } from "@/lib/cooking/timerStore";
import { preferenceForSystem } from "@/lib/domain/recipe/unit";

vi.mock("@/hooks/use-cooking-timers", () => ({
  useCookingTimer: vi.fn(),
  useCookingTimers: vi.fn(() => []),
}));

vi.mock("@/lib/cooking/timerStore", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/cooking/timerStore")>();
  return { ...original, startTimer: vi.fn() };
});

const mockUseCookingTimer = vi.mocked(useCookingTimer);

const steps: CookStep[] = [
  {
    key: "0:boil",
    tokens: [
      { type: "text", value: "Boil for " },
      {
        type: "timer",
        value: "10 min",
        durationSeconds: 600,
        timerId: "pasta:s0:t1",
      },
    ],
    text: "Boil for 10 min",
  },
];

function renderCookMode() {
  return render(
    <CookModeProvider>
      <CookMode
        recipeSlug="pasta"
        recipeTitle="Pasta"
        servings={2}
        steps={steps}
        ingredientGroups={[]}
        annotations={new Map()}
        scale={1}
        system={preferenceForSystem("metric")}
        step={0}
        onStepChange={() => {}}
        onExit={() => {}}
        onComplete={() => {}}
      />
      <ActiveStepProbe />
    </CookModeProvider>,
    { container: document.body },
  );
}

function ActiveStepProbe() {
  const { activeStep } = useCookMode();
  return (
    <output data-testid="active-step">{JSON.stringify(activeStep)}</output>
  );
}

describe("CookMode timer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCookingTimer.mockReturnValue(undefined);
  });

  it("starts the timer when the countdown circle itself is tapped", async () => {
    const user = userEvent.setup();
    renderCookMode();

    await user.click(
      screen.getByRole("button", { name: "Start 10 min timer" }),
    );

    expect(startTimer).toHaveBeenCalledWith({
      id: "pasta:s0:t1",
      recipeSlug: "pasta",
      recipeTitle: "Pasta",
      label: "10 min",
      stepIndex: 0,
      stepText: "Boil for 10 min",
      durationSeconds: 600,
    });
  });

  it("publishes the current step for dock timers", () => {
    renderCookMode();

    expect(screen.getByTestId("active-step")).toHaveTextContent(
      JSON.stringify({
        recipeSlug: "pasta",
        recipeTitle: "Pasta",
        stepIndex: 0,
        stepText: "Boil for 10 min",
      }),
    );
  });

  it("dims the idle full duration so it does not read as a live countdown", () => {
    renderCookMode();

    const idleDuration = screen.getByText("10:00");
    expect(idleDuration).toHaveClass("opacity-60");
  });

  it("shows a live countdown at full opacity once running", () => {
    mockUseCookingTimer.mockReturnValue({
      id: "pasta:s0:t1",
      label: "10 min",
      durationSeconds: 600,
      remainingSeconds: 600,
      endTimeMs: Date.now() + 600_000,
      state: "running",
    });
    renderCookMode();

    const liveCountdown = screen.getByText("10:00");
    expect(liveCountdown).not.toHaveClass("opacity-60");
    expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();
  });
});
