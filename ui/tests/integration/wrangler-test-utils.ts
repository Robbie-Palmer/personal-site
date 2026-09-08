import type { ChildProcess } from "node:child_process";
import { dirname, resolve } from "node:path";
import { StringDecoder } from "node:string_decoder";
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
  readyText = "Ready on",
): Promise<void> {
  return new Promise((resolve, reject) => {
    const stderrDecoder = new StringDecoder("utf8");
    const stdoutDecoder = new StringDecoder("utf8");
    let outputTail = "";
    let readinessTail = "";
    let settled = false;

    const appendOutput = (chunk: string) => {
      outputTail =
        chunk.length >= SERVER_OUTPUT_TAIL_LENGTH
          ? chunk.slice(-SERVER_OUTPUT_TAIL_LENGTH)
          : `${outputTail}${chunk}`.slice(-SERVER_OUTPUT_TAIL_LENGTH);
    };

    const recordOutput = (data: Buffer, decoder: StringDecoder) => {
      appendOutput(decoder.write(data));
    };

    const recordStdout = (data: Buffer) => {
      const chunk = stdoutDecoder.write(data);
      const readinessCandidate = `${readinessTail}${chunk}`;
      readinessTail =
        readyText.length > 1
          ? readinessCandidate.slice(-(readyText.length - 1))
          : "";

      appendOutput(chunk);
      return readinessCandidate.includes(readyText);
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
      if (settled) return;
      killProcessGroup(proc);
      fail(`Server did not start within ${timeout}ms`);
    }, timeout);

    proc.stdout?.on("data", (data: Buffer) => {
      const isReady = recordStdout(data);
      if (!settled && isReady) {
        settled = true;
        clearTimeout(timer);
        resolve();
      }
    });
    proc.stdout?.once("end", () => appendOutput(stdoutDecoder.end()));

    // Keep both pipes flowing after startup. Wrangler and workerd can emit a
    // large stack trace when a browser closes with requests in flight. An
    // unread pipe eventually blocks the dev server and changes page timing.
    proc.stderr?.on("data", (data: Buffer) =>
      recordOutput(data, stderrDecoder),
    );
    proc.stderr?.once("end", () => appendOutput(stderrDecoder.end()));

    proc.once("error", (error) => {
      fail(`Wrangler process failed before startup: ${error.message}`);
    });

    proc.once("close", (code, signal) => {
      const exitReason =
        code === null ? `signal ${signal ?? "unknown"}` : `code ${code}`;
      fail(`Wrangler process closed before startup with ${exitReason}`);
    });
  });
}
