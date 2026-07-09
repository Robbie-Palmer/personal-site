import type { ChildProcess } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

// Keep Pages dev deterministic in CI. Wrangler otherwise defaults to today's
// date, which can be newer than the workerd binary bundled with the installed
// package. Match the repo's explicit Worker compatibility date.
export const WRANGLER_TEST_COMPATIBILITY_DATE = "2026-05-28";

export function getWranglerTestRepoRoot(): string {
  return REPO_ROOT;
}

/**
 * Kills a spawned process and its children. Wrangler spawns workerd
 * subprocesses that survive a plain kill() and keep holding ports, so the
 * process must be spawned with `detached: true` and killed as a group.
 */
export function killProcessGroup(proc: ChildProcess | undefined): void {
  if (!proc?.pid) return;
  try {
    process.kill(-proc.pid, "SIGTERM");
  } catch {
    proc.kill();
  }
}

/** Waits for a wrangler dev server to report readiness on stdout. */
export async function waitForServer(
  proc: ChildProcess,
  timeout: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      killProcessGroup(proc);
      reject(new Error(`Server did not start within ${timeout}ms`));
    }, timeout);

    proc.stdout?.on("data", (data: Buffer) => {
      if (data.toString().includes("Ready on")) {
        clearTimeout(timer);
        resolve();
      }
    });

    proc.on("exit", (code) => {
      clearTimeout(timer);
      if (code !== 0 && code !== null) {
        reject(new Error(`Wrangler process exited with code ${code}`));
      }
    });
  });
}
