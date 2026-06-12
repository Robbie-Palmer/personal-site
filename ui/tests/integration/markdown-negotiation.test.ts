import { type ChildProcess, spawn } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const WRANGLER_PORT = 8791;
const BASE_URL = `http://localhost:${WRANGLER_PORT}`;

const BROWSER_ACCEPT =
  "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

describe("Markdown content negotiation middleware", () => {
  let wranglerProcess: ChildProcess;

  beforeAll(async () => {
    wranglerProcess = spawn(
      "npx",
      [
        "wrangler",
        "pages",
        "dev",
        "ui/out",
        "--port",
        String(WRANGLER_PORT),
        // Distinct inspector port so this can run alongside other wrangler
        // instances (e.g. the PostHog proxy test)
        "--inspector-port",
        "9239",
      ],
      {
        cwd: process.cwd().replace(/\/ui$/, ""),
        stdio: ["ignore", "pipe", "pipe"],
        // Own process group so cleanup also kills spawned workerd children
        detached: true,
      },
    );
    await waitForServer(wranglerProcess, 30000);
  }, 60000);

  afterAll(() => {
    killProcessGroup(wranglerProcess);
  });

  it("serves markdown when the Accept header asks for it", async () => {
    const response = await fetch(`${BASE_URL}/projects`, {
      headers: { Accept: "text/markdown", "User-Agent": BROWSER_UA },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/markdown");
    const body = await response.text();
    expect(body).toContain("# Projects");
    expect(body).toContain("# Building Philosophy");
  });

  it("serves markdown to agent-like user agents not requesting HTML", async () => {
    const response = await fetch(`${BASE_URL}/experience`, {
      headers: { Accept: "*/*", "User-Agent": "curl/8.5.0" },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/markdown");
    expect(await response.text()).toContain("# Experience");
  });

  it("serves HTML to browsers", async () => {
    const response = await fetch(`${BASE_URL}/projects`, {
      headers: { Accept: BROWSER_ACCEPT, "User-Agent": BROWSER_UA },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toContain("<!DOCTYPE html>");
  });

  it("serves the .md twin directly regardless of headers", async () => {
    const response = await fetch(`${BASE_URL}/projects.md`, {
      headers: { Accept: BROWSER_ACCEPT, "User-Agent": BROWSER_UA },
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("# Projects");
  });

  it("maps / to index.md and falls back to HTML when no twin exists", async () => {
    const response = await fetch(`${BASE_URL}/`, {
      headers: { Accept: "*/*", "User-Agent": "curl/8.5.0" },
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("# Robbie Palmer");

    const noTwin = await fetch(`${BASE_URL}/assettracker`, {
      headers: { Accept: BROWSER_ACCEPT, "User-Agent": BROWSER_UA },
    });
    expect(noTwin.status).toBe(200);
    expect(noTwin.headers.get("content-type")).toContain("text/html");
  });
});

function killProcessGroup(proc: ChildProcess | undefined): void {
  if (!proc?.pid) return;
  try {
    process.kill(-proc.pid, "SIGTERM");
  } catch {
    proc.kill();
  }
}

async function waitForServer(
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
  });
}
