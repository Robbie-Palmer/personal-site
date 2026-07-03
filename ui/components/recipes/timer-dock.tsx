"use client";

import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Pause,
  Play,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useCookingTimers } from "@/hooks/use-cooking-timers";
import {
  type CookingTimer,
  dismissTimer,
  extendTimer,
  formatCountdown,
  pauseTimer,
  resumeTimer,
} from "@/lib/cooking/timerStore";

const POSITION_KEY = "cooking-timer-dock-pos:v1";
const EDGE_MARGIN = 8;

/** Offsets from the bottom-right corner, so the dock hugs its default anchor. */
type DockPosition = { right: number; bottom: number };

function loadPosition(): DockPosition | null {
  try {
    const raw = localStorage.getItem(POSITION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as DockPosition).right === "number" &&
      typeof (parsed as DockPosition).bottom === "number"
    ) {
      return parsed as DockPosition;
    }
  } catch {
    // localStorage unavailable
  }
  return null;
}

function savePosition(position: DockPosition): void {
  try {
    localStorage.setItem(POSITION_KEY, JSON.stringify(position));
  } catch {
    // localStorage unavailable
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/** Completed timers first (they need attention), then soonest-ending. */
function byUrgency(a: CookingTimer, b: CookingTimer): number {
  if ((a.state === "completed") !== (b.state === "completed")) {
    return a.state === "completed" ? -1 : 1;
  }
  return a.remainingSeconds - b.remainingSeconds;
}

function dotColor(timer: CookingTimer): string {
  return timer.state === "completed"
    ? "var(--terracotta)"
    : timer.state === "paused"
      ? "var(--ink-4)"
      : "var(--butter)";
}

/**
 * Floating dock for every active cooking timer. Collapsed (the default) it is
 * a single compact pill showing the most urgent timer plus a count of the
 * rest, so several running timers never wall off the page; expanding reveals
 * per-timer controls. Draggable by its grip handle, and the position sticks.
 */
export function TimerDock() {
  const timers = useCookingTimers();
  const [expanded, setExpanded] = useState(false);
  const [position, setPosition] = useState<DockPosition | null>(null);
  const dockRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startRight: number;
    startBottom: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    setPosition(loadPosition());
  }, []);

  // A dragged position is stored as bottom-right offsets measured at the
  // dock's size at drag time. Expanding, gaining timers, or rotating the
  // screen changes the dock's size (or the viewport), which can push parts of
  // it off-screen — re-clamp whenever that happens so the controls stay
  // reachable.
  const clampToViewport = useCallback(() => {
    setPosition((current) => {
      if (!current) return current;
      const rect = dockRef.current?.getBoundingClientRect();
      if (!rect) return current;
      const next = {
        right: clamp(
          current.right,
          EDGE_MARGIN,
          window.innerWidth - rect.width - EDGE_MARGIN,
        ),
        bottom: clamp(
          current.bottom,
          EDGE_MARGIN,
          window.innerHeight - rect.height - EDGE_MARGIN,
        ),
      };
      if (next.right === current.right && next.bottom === current.bottom) {
        return current;
      }
      savePosition(next);
      return next;
    });
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: expanded and timers.length change the dock's size, which is what requires re-clamping
  useLayoutEffect(() => {
    clampToViewport();
  }, [expanded, timers.length, clampToViewport]);

  useEffect(() => {
    window.addEventListener("resize", clampToViewport);
    return () => window.removeEventListener("resize", clampToViewport);
  }, [clampToViewport]);

  const onGripPointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const dock = dockRef.current;
      if (!dock) return;
      const rect = dock.getBoundingClientRect();
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startRight: window.innerWidth - rect.right,
        startBottom: window.innerHeight - rect.bottom,
        moved: false,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    [],
  );

  const onGripPointerMove = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      const rect = dockRef.current?.getBoundingClientRect();
      drag.moved = true;
      setPosition({
        right: clamp(
          drag.startRight + (drag.startX - event.clientX),
          EDGE_MARGIN,
          window.innerWidth - (rect?.width ?? 0) - EDGE_MARGIN,
        ),
        bottom: clamp(
          drag.startBottom + (drag.startY - event.clientY),
          EDGE_MARGIN,
          window.innerHeight - (rect?.height ?? 0) - EDGE_MARGIN,
        ),
      });
    },
    [],
  );

  const onGripPointerEnd = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      dragRef.current = null;
      if (drag.moved) {
        setPosition((current) => {
          if (current) savePosition(current);
          return current;
        });
      }
    },
    [],
  );

  if (timers.length === 0) return null;

  const sorted = [...timers].sort(byUrgency);
  const primary = sorted[0];
  if (!primary) return null;

  const grip = (
    <button
      type="button"
      aria-label="Move timers"
      onPointerDown={onGripPointerDown}
      onPointerMove={onGripPointerMove}
      onPointerUp={onGripPointerEnd}
      onPointerCancel={onGripPointerEnd}
      className="touch-none cursor-grab self-stretch rounded-full px-1 py-2 opacity-50 transition-opacity hover:opacity-90 active:cursor-grabbing"
      title="Drag to move"
    >
      <GripVertical className="size-4" />
    </button>
  );

  return (
    <section
      ref={dockRef}
      aria-label="Cooking timers"
      className="rt-timer-dock fixed right-3 bottom-3 z-[80] sm:right-4 sm:bottom-4"
      style={
        position
          ? { right: position.right, bottom: position.bottom }
          : undefined
      }
    >
      {expanded ? (
        <div className="flex min-w-60 max-w-[calc(100vw-1rem)] flex-col rounded-2xl bg-[var(--ink)] p-2 text-[var(--paper)] shadow-lg">
          <div className="flex items-center gap-1">
            {grip}
            <span className="rt-mono flex-1 text-[9px] text-[var(--ink-4)]">
              cooking timers
            </span>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-expanded="true"
              aria-label="Collapse timers"
              className="rounded-full p-2 opacity-70 transition-opacity hover:opacity-100"
            >
              <ChevronDown className="size-4" />
            </button>
          </div>
          {/* Many timers must scroll inside the panel rather than grow it
              past the top of the screen. */}
          <div className="max-h-[45vh] overflow-y-auto overscroll-contain">
            {sorted.map((timer) => (
              <DockRow key={timer.id} timer={timer} />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center rounded-full bg-[var(--ink)] py-1 pr-2.5 pl-1.5 text-[var(--paper)] shadow-lg">
          {grip}
          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-expanded="false"
            aria-label={`Expand cooking timers (${sorted.length})`}
            className="flex items-center gap-2 py-0.5 pl-1"
          >
            <span className="flex min-w-0 flex-col text-left leading-tight">
              <span
                className={[
                  "rt-mono max-w-32 truncate text-[9px]",
                  primary.state === "completed" ? "animate-pulse" : "",
                ].join(" ")}
                style={{ color: dotColor(primary) }}
              >
                ● {primary.label}
              </span>
              <span
                className={[
                  "rt-display text-xl leading-none tabular-nums",
                  primary.state === "paused" ? "opacity-60" : "",
                  primary.state === "completed" ? "animate-pulse" : "",
                ].join(" ")}
              >
                {primary.state === "completed"
                  ? "done!"
                  : formatCountdown(primary.remainingSeconds)}
              </span>
            </span>
            {sorted.length > 1 && (
              <span className="rt-mono rounded-full bg-[var(--paper)]/15 px-1.5 py-0.5 text-[9px]">
                +{sorted.length - 1}
              </span>
            )}
            <ChevronUp className="size-3.5 opacity-60" />
          </button>
        </div>
      )}
    </section>
  );
}

function DockRow({ timer }: { timer: CookingTimer }) {
  const completed = timer.state === "completed";
  const paused = timer.state === "paused";

  return (
    <div className="flex items-center gap-1.5 rounded-lg px-1 py-0.5">
      <Link
        href={`/recipes/${timer.recipeSlug}`}
        className={[
          "flex min-w-0 flex-1 flex-col leading-tight",
          completed ? "animate-pulse" : "",
        ].join(" ")}
        title={`${timer.recipeTitle} — ${timer.label}`}
      >
        <span
          className="rt-mono max-w-36 truncate text-[9px]"
          style={{ color: dotColor(timer) }}
        >
          ● {timer.label}
        </span>
        <span
          className={[
            "rt-display text-lg leading-none tabular-nums",
            paused ? "opacity-60" : "",
          ].join(" ")}
        >
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
          className="rt-mono rounded-full px-1 py-2 text-[10px] opacity-70 transition-opacity hover:opacity-100"
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
