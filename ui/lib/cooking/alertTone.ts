/**
 * Shared audio alert for cooking timers.
 *
 * Browsers only allow audio started from a user gesture, so
 * `ensureAudioUnlocked` must be called from a click/tap handler (starting or
 * resuming a timer). Once unlocked, the shared context can play the completion
 * tone later even when the trigger is a background interval tick.
 */

let audioCtx: AudioContext | null = null;

export function ensureAudioUnlocked(): void {
  try {
    if (!audioCtx) {
      audioCtx = new AudioContext();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
  } catch {
    // Web Audio not available
  }
}

export function playAlertTone(): void {
  const ctx = audioCtx;
  if (ctx?.state !== "running") return;

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
