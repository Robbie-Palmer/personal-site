"use client";

import { Pause, Play, X } from "lucide-react";
import Link from "next/link";
import { useCookingTimers } from "@/hooks/use-cooking-timers";
import {
  type CookingTimer,
  dismissTimer,
  extendTimer,
  formatCountdown,
  pauseTimer,
  resumeTimer,
} from "@/lib/cooking/timerStore";

/**
 * Floating dock listing every active cooking timer. Mounted once in the
 * recipes layout so timers stay visible (and controllable) while moving
 * between the recipe box, recipe pages, and cook mode.
 */
export function TimerDock() {
  const timers = useCookingTimers();
  if (timers.length === 0) return null;

  return (
    <div
      role="status"
      aria-label="Cooking timers"
      className="rt-timer-dock pointer-events-none fixed inset-x-2 bottom-2 z-[80] flex flex-wrap items-end justify-center gap-2 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:flex-col sm:items-end"
    >
      {timers.map((timer) => (
        <DockTimer key={timer.id} timer={timer} />
      ))}
    </div>
  );
}

function DockTimer({ timer }: { timer: CookingTimer }) {
  const completed = timer.state === "completed";
  const paused = timer.state === "paused";
  const dotColor = completed
    ? "var(--terracotta)"
    : paused
      ? "var(--ink-4)"
      : "var(--butter)";

  return (
    <div
      className={[
        "pointer-events-auto flex items-center gap-1.5 rounded-full bg-[var(--ink)] py-1.5 pr-1.5 pl-4 text-[var(--paper)] shadow-lg",
        completed ? "animate-pulse" : "",
      ].join(" ")}
    >
      <Link
        href={`/recipes/${timer.recipeSlug}`}
        className="flex min-w-0 flex-col leading-tight"
        title={`${timer.recipeTitle} — ${timer.label}`}
      >
        <span
          className="rt-mono max-w-36 truncate text-[9px]"
          style={{ color: dotColor }}
        >
          ● {timer.label}
          {paused && " · paused"}
        </span>
        <span className="rt-display text-xl leading-none tabular-nums">
          {completed ? "done!" : formatCountdown(timer.remainingSeconds)}
        </span>
      </Link>
      {!completed && (
        <button
          type="button"
          onClick={() =>
            paused ? resumeTimer(timer.id) : pauseTimer(timer.id)
          }
          className="rounded-full p-2 opacity-70 transition-opacity hover:opacity-100"
          aria-label={
            paused
              ? `Resume ${timer.label} timer`
              : `Pause ${timer.label} timer`
          }
        >
          {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
        </button>
      )}
      {!completed && (
        <button
          type="button"
          onClick={() => extendTimer(timer.id)}
          className="rt-mono rounded-full px-1.5 py-2 text-[10px] opacity-70 transition-opacity hover:opacity-100"
          aria-label={`Add one minute to ${timer.label} timer`}
        >
          +1m
        </button>
      )}
      <button
        type="button"
        onClick={() => dismissTimer(timer.id)}
        className="rounded-full p-2 opacity-70 transition-opacity hover:opacity-100"
        aria-label={`Dismiss ${timer.label} timer`}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
