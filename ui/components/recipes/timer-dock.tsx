"use client";

import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Pause,
  Play,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
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

/**
 * Minimum bottom offset while cook mode is open, so the dock clears the
 * cook-mode footer (progress bar + prev/next). Applied on top of any dragged
 * position without persisting it, so the dock drops back once cooking ends.
 */
function cookModeFooterClearance(): number {
  return globalThis.innerWidth >= 640 ? 116 : 140;
}

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
  if (timer.state === "completed") return "var(--terracotta)";
  if (timer.state === "paused") return "var(--ink-4)";
  return "var(--butter)";
}

/**
 * Link back to the timer's recipe, deep-linking straight into cook mode at the
 * step that started it when we know which step that was. Slug is encoded as
 * defense-in-depth even though recipe slugs are build-time safe.
 */
function timerHref(timer: CookingTimer): string {
  const base = `/recipes/${encodeURIComponent(timer.recipeSlug)}`;
  return timer.stepIndex === undefined
    ? base
    : `${base}?cook=1&step=${timer.stepIndex + 1}`;
}

/** Short "step N" tag when the originating step is known. */
function stepTag(timer: CookingTimer): string | null {
  return timer.stepIndex === undefined ? null : `step ${timer.stepIndex + 1}`;
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

  const [cookModeOpen, setCookModeOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setPosition(loadPosition());
  }, []);

  // Track whether cook mode is open so we can lift the dock above its footer
  // even after the user has dragged (an inline style would otherwise beat a
  // stylesheet rule).
  useEffect(() => {
    const body = document.body;
    const update = () =>
      setCookModeOpen(body.classList.contains("rt-cook-mode-open"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(body, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
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
          globalThis.innerWidth - rect.width - EDGE_MARGIN,
        ),
        bottom: clamp(
          current.bottom,
          EDGE_MARGIN,
          globalThis.innerHeight - rect.height - EDGE_MARGIN,
        ),
      };
      if (next.right === current.right && next.bottom === current.bottom) {
        return current;
      }
      savePosition(next);
      return next;
    });
  }, []);

  // Re-clamp when the dock's size changes (expand / timer count) and, crucially,
  // right after a persisted position is restored on mount — the saved offsets
  // were measured in a possibly larger viewport and could land off-screen.
  // biome-ignore lint/correctness/useExhaustiveDependencies: expanded/timers.length/position drive the re-clamp even though clampToViewport doesn't close over them
  useLayoutEffect(() => {
    clampToViewport();
  }, [expanded, timers.length, position, clampToViewport]);

  useEffect(() => {
    globalThis.addEventListener("resize", clampToViewport);
    return () => globalThis.removeEventListener("resize", clampToViewport);
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
        startRight: globalThis.innerWidth - rect.right,
        startBottom: globalThis.innerHeight - rect.bottom,
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
          globalThis.innerWidth - (rect?.width ?? 0) - EDGE_MARGIN,
        ),
        bottom: clamp(
          drag.startBottom + (drag.startY - event.clientY),
          EDGE_MARGIN,
          globalThis.innerHeight - (rect?.height ?? 0) - EDGE_MARGIN,
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

  if (!mounted || timers.length === 0) return null;

  const sorted = [...timers].sort(byUrgency);
  const primary = sorted[0];
  if (!primary) return null;

  // Positioning: default anchor comes from CSS classes; a dragged position is
  // applied inline. While cook mode is open, raise the bottom to clear its
  // footer without mutating the stored position.
  let style: React.CSSProperties | undefined;
  if (position) {
    style = {
      right: position.right,
      bottom: cookModeOpen
        ? Math.max(position.bottom, cookModeFooterClearance())
        : position.bottom,
    };
  } else if (cookModeOpen) {
    style = { bottom: cookModeFooterClearance() };
  }

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

  // Portaled to <body> (a sibling of the cook-mode dialog, which also portals
  // to <body>) so cook mode can mark the rest of the app inert for assistive
  // tech while leaving the dock reachable. Theme tokens come from the classes
  // RecipeThemeBody mirrors onto <body>.
  return createPortal(
    <section
      ref={dockRef}
      aria-label="Cooking timers"
      className="rt-timer-dock fixed right-3 bottom-3 z-[80] sm:right-4 sm:bottom-4"
      style={style}
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
                  "rt-mono max-w-40 truncate text-[9px]",
                  primary.state === "completed" ? "animate-pulse" : "",
                ].join(" ")}
                style={{ color: dotColor(primary) }}
              >
                ● {primary.label}
                {stepTag(primary) && (
                  <span className="text-[var(--ink-4)]">
                    {" "}
                    · {stepTag(primary)}
                  </span>
                )}
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
    </section>,
    document.body,
  );
}

function DockRow({ timer }: Readonly<{ timer: CookingTimer }>) {
  const completed = timer.state === "completed";
  const paused = timer.state === "paused";
  const tag = stepTag(timer);
  const tooltip = [
    timer.recipeTitle,
    tag && `${tag} of ${timer.recipeTitle}`,
    timer.stepText,
  ]
    .filter(Boolean)
    .join(" — ");

  return (
    <div className="flex items-center gap-1.5 rounded-lg px-1 py-0.5">
      {/* A plain <a> (full navigation), not next/link: deep-linking into cook
          mode relies on RecipeContent reading ?cook=1&step=N on mount, which a
          client-side transition to the same recipe route wouldn't retrigger.
          Timers persist across the reload, so the dock survives. */}
      <a
        href={timerHref(timer)}
        className={[
          "flex min-w-0 flex-1 flex-col leading-tight",
          completed ? "animate-pulse" : "",
        ].join(" ")}
        title={tooltip}
      >
        <span
          className="rt-mono max-w-40 truncate text-[9px]"
          style={{ color: dotColor(timer) }}
        >
          ● {timer.label}
          {tag && <span className="text-[var(--ink-4)]"> · {tag}</span>}
        </span>
        <span className="max-w-40 truncate font-[family-name:var(--font-kalam)] text-[10px] text-[var(--ink-4)]">
          {timer.stepText || timer.recipeTitle}
        </span>
        <span
          className={[
            "rt-display text-lg leading-none tabular-nums",
            paused ? "opacity-60" : "",
          ].join(" ")}
        >
          {completed ? "done!" : formatCountdown(timer.remainingSeconds)}
        </span>
      </a>
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
