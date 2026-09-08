import type { ChildProcess } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

// Keep Pages dev deterministic in CI. Wrangler otherwise defaults to today's
// date, which can be newer than the workerd binary bundled with the installed
// package. Match the repo's explicit Worker compatibility date.
export const WRANGLER_TEST_COMPATIBILITY_DATE = "2026-05-28";

const SERVER_OUTPUT_TAIL_LENGTH = 16_384;

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

/** Waits for Wrangler readiness and keeps both output pipes drained. */
export async function waitForServer(
  proc: ChildProcess,
  timeout: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let outputTail = "";
    let settled = false;

    const recordOutput = (data: Buffer) => {
      outputTail = `${outputTail}${data.toString()}`.slice(
        -SERVER_OUTPUT_TAIL_LENGTH,
      );
    };

    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const diagnostic = outputTail.trim();
      reject(
        new Error(
          diagnostic.length > 0 ? `${message}\n\n${diagnostic}` : message,
        ),
      );
    };

    const timer = setTimeout(() => {
      killProcessGroup(proc);
      fail(`Server did not start within ${timeout}ms`);
    }, timeout);

    proc.stdout?.on("data", (data: Buffer) => {
      recordOutput(data);
      if (!settled && outputTail.includes("Ready on")) {
        settled = true;
        clearTimeout(timer);
        resolve();
      }
    });

    // Keep both pipes flowing after startup. Wrangler and workerd can emit a
    // large stack trace when a browser closes with requests in flight. An
    // unread pipe eventually blocks the dev server and changes page timing.
    proc.stderr?.on("data", recordOutput);

    proc.on("exit", (code) => {
      fail(`Wrangler process exited before startup with code ${code}`);
    });
  });
}
