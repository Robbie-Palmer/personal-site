/**
 * Reference-counted screen wake lock.
 *
 * Multiple features want the screen kept awake (cook mode being open, any
 * timer running), so each holds the lock under its own key; the sentinel is
 * released only when no keys remain. The browser silently releases wake locks
 * when the tab is hidden, so we re-acquire on visibility change.
 */

const holders = new Set<string>();
let sentinel: WakeLockSentinel | null = null;
// Invalidates in-flight requests when holders empty out mid-await.
let epoch = 0;
let visibilityHooked = false;

export function isWakeLockSupported(): boolean {
  return typeof navigator !== "undefined" && "wakeLock" in navigator;
}

function hookVisibility(): void {
  if (visibilityHooked || typeof document === "undefined") return;
  visibilityHooked = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && holders.size > 0) {
      acquire();
    }
  });
}

async function acquire(): Promise<void> {
  if (!isWakeLockSupported() || sentinel !== null) return;
  const requestEpoch = ++epoch;
  try {
    const lock = await navigator.wakeLock.request("screen");
    if (requestEpoch !== epoch || holders.size === 0) {
      lock.release().catch(() => {});
      return;
    }
    sentinel = lock;
    lock.addEventListener("release", () => {
      if (sentinel === lock) sentinel = null;
    });
  } catch {
    // Not available right now (e.g. tab hidden, low battery)
  }
}

export function retainWakeLock(key: string): void {
  holders.add(key);
  hookVisibility();
  acquire();
}

export function releaseWakeLock(key: string): void {
  holders.delete(key);
  if (holders.size === 0) {
    epoch += 1;
    sentinel?.release().catch(() => {});
    sentinel = null;
  }
}
