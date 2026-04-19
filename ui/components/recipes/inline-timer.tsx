"use client";

import { Pause, RotateCcw, Timer, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";

type TimerState = "idle" | "running" | "paused" | "completed";

function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function playAlertTone(ctx: AudioContext) {
  const beep = (startTime: number, freq: number, duration: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.3, startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
    osc.start(startTime);
    osc.stop(startTime + duration);
  };
  const now = ctx.currentTime;
  beep(now, 880, 0.15);
  beep(now + 0.2, 880, 0.15);
  beep(now + 0.4, 1100, 0.3);
}

export function InlineTimer({
  durationSeconds,
  label,
}: {
  durationSeconds: number | null;
  label: string;
}) {
  const [state, setState] = useState<TimerState>("idle");
  const [remaining, setRemaining] = useState(durationSeconds ?? 0);
  const remainingRef = useRef(remaining);
  remainingRef.current = remaining;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  }, []);

  const requestWakeLock = useCallback(async () => {
    if ("wakeLock" in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      } catch {
        // Wake lock not available (e.g., tab not visible)
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      clearTimer();
      releaseWakeLock();
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
    };
  }, [clearTimer, releaseWakeLock]);

  useEffect(() => {
    if (state === "running" && remaining <= 0) {
      clearTimer();
      releaseWakeLock();
      setState("completed");
      if (audioCtxRef.current) {
        playAlertTone(audioCtxRef.current);
      }
    }
  }, [remaining, state, clearTimer, releaseWakeLock]);

  const startCountdown = useCallback(() => {
    clearTimer();
    intervalRef.current = setInterval(() => {
      setRemaining(remainingRef.current - 1);
    }, 1000);
  }, [clearTimer]);

  const reset = useCallback(() => {
    clearTimer();
    releaseWakeLock();
    setRemaining(durationSeconds ?? 0);
    setState("idle");
  }, [clearTimer, releaseWakeLock, durationSeconds]);

  const ensureAudioContext = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume().catch(() => {});
      }
    } catch {
      // Web Audio not available
    }
  }, []);

  const handleClick = useCallback(() => {
    if (durationSeconds === null) return;
    ensureAudioContext();

    switch (state) {
      case "idle":
        setRemaining(durationSeconds);
        setState("running");
        startCountdown();
        requestWakeLock();
        break;
      case "running":
        clearTimer();
        setState("paused");
        break;
      case "paused":
        setState("running");
        startCountdown();
        break;
      case "completed":
        reset();
        break;
    }
  }, [
    state,
    durationSeconds,
    startCountdown,
    clearTimer,
    requestWakeLock,
    reset,
    ensureAudioContext,
  ]);

  if (durationSeconds === null) {
    return (
      <Badge variant="outline" className="align-baseline">
        <Timer className="size-3" />
        {label}
      </Badge>
    );
  }

  const variant =
    state === "completed"
      ? "destructive"
      : state === "running" || state === "paused"
        ? "default"
        : "outline";

  return (
    <Badge
      variant={variant}
      interactive
      active={state === "running"}
      onClick={handleClick}
      className={`align-baseline ${state === "completed" ? "animate-pulse" : ""}`}
      aria-label={
        state === "idle"
          ? `Start ${label} timer`
          : state === "running"
            ? `Pause timer, ${formatCountdown(remaining)} remaining`
            : state === "paused"
              ? `Resume timer, ${formatCountdown(remaining)} remaining`
              : "Timer complete, click to reset"
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
      {(state === "running" || state === "paused") && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            reset();
          }}
          className="ml-0.5 rounded-sm opacity-60 hover:opacity-100"
          aria-label="Reset timer"
        >
          <X className="size-3" />
        </button>
      )}
    </Badge>
  );
}
