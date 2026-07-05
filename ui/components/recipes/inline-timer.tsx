"use client";

import { Pause, RotateCcw, Timer, X } from "lucide-react";
import { useCallback } from "react";
import { badgeVariants } from "@/components/ui/badge";
import { useCookingTimer } from "@/hooks/use-cooking-timers";
import {
  dismissTimer,
  formatCountdown,
  pauseTimer,
  resumeTimer,
  startTimer,
} from "@/lib/cooking/timerStore";
import { cn } from "@/lib/generic/styles";

/**
 * Tap-to-start countdown pill rendered inline in a method step. State lives
 * in the global timer store, so the same countdown is mirrored in cook mode
 * and the floating timer dock, and keeps running across page navigation.
 */
export function InlineTimer({
  timerId,
  recipeSlug,
  recipeTitle,
  stepIndex,
  stepText,
  durationSeconds,
  label,
}: Readonly<{
  timerId: string;
  recipeSlug: string;
  recipeTitle: string;
  stepIndex?: number;
  stepText?: string;
  durationSeconds: number | null;
  label: string;
}>) {
  const timer = useCookingTimer(timerId);
  const state = timer?.state ?? "idle";
  const remaining = timer?.remainingSeconds ?? durationSeconds ?? 0;

  const handleClick = useCallback(() => {
    if (durationSeconds === null) return;
    switch (state) {
      case "idle":
        startTimer({
          id: timerId,
          recipeSlug,
          recipeTitle,
          label,
          stepIndex,
          stepText,
          durationSeconds,
        });
        break;
      case "running":
        pauseTimer(timerId);
        break;
      case "paused":
        resumeTimer(timerId);
        break;
      case "completed":
        dismissTimer(timerId);
        break;
    }
  }, [
    state,
    durationSeconds,
    timerId,
    recipeSlug,
    recipeTitle,
    stepIndex,
    stepText,
    label,
  ]);

  if (durationSeconds === null) {
    return (
      <span
        data-recipe-pill
        className={cn(badgeVariants({ variant: "outline" }), "align-baseline")}
      >
        <Timer className="size-3" />
        {label}
      </span>
    );
  }

  const variant =
    state === "completed"
      ? "destructive"
      : state === "running" || state === "paused"
        ? "default"
        : "outline";

  const showReset = state === "running" || state === "paused";

  return (
    <span
      data-recipe-pill
      className={cn(
        badgeVariants({
          variant,
          interactive: true,
          active: state === "running",
        }),
        "align-baseline text-[0.8125rem] font-semibold",
        // The idle timer should read as an inviting, tappable control rather
        // than recede into the method text — warm fill + emphasised label.
        state === "idle" && "bg-[var(--butter-soft)] text-[var(--ink)]",
        state === "completed" && "animate-pulse",
      )}
    >
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-1"
        aria-label={
          state === "idle"
            ? `Start ${label} timer`
            : state === "running"
              ? `Pause timer, ${formatCountdown(remaining)} remaining`
              : state === "paused"
                ? `Resume timer, ${formatCountdown(remaining)} remaining`
                : "Timer complete, click to dismiss"
        }
      >
        {state === "paused" ? (
          <Pause className="size-3" />
        ) : state === "completed" ? (
          <RotateCcw className="size-3" />
        ) : (
          <Timer className="size-3" />
        )}
        {state === "idle" ? label : formatCountdown(remaining)}
      </button>
      {showReset && (
        <button
          type="button"
          onClick={() => dismissTimer(timerId)}
          className="ml-0.5 rounded-sm opacity-60 hover:opacity-100"
          aria-label="Cancel timer"
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  );
}
