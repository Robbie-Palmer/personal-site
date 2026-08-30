import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import puppeteer, { type Browser } from "puppeteer";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  getWranglerTestRepoRoot,
  killProcessGroup,
} from "./wrangler-test-utils";

const SERVER_PORT = 8792;
const BASE_URL = `http://127.0.0.1:${SERVER_PORT}`;
const UI_ROOT = resolve(getWranglerTestRepoRoot(), "ui");

function findSystemChrome(): string | undefined {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ];

  return candidates.find(
    (candidate): candidate is string =>
      candidate !== undefined && existsSync(candidate),
  );
}

async function waitForPage(url: string, timeout: number): Promise<void> {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The server may not have bound its port yet.
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }

  throw new Error(`Static server did not serve ${url} within ${timeout}ms`);
}

describe("Visualization browser rendering", () => {
  let browser: Browser;
  let serverProcess: ChildProcess;

  beforeAll(async () => {
    serverProcess = spawn(
      "pnpm",
      [
        "exec",
        "serve",
        "out",
        "--listen",
        `tcp://127.0.0.1:${SERVER_PORT}`,
        "--no-clipboard",
        "--no-port-switching",
      ],
      {
        cwd: UI_ROOT,
        stdio: ["ignore", "pipe", "pipe"],
        detached: true,
      },
    );

    await waitForPage(`${BASE_URL}/technologies/mermaid`, 30_000);
    browser = await puppeteer.launch({
      headless: true,
      args: ["--disable-setuid-sandbox", "--no-sandbox"],
      executablePath: findSystemChrome(),
    });
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
    killProcessGroup(serverProcess);
  });

  it("renders the technology demos as visible SVG diagrams", async () => {
    const page = await browser.newPage();
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));

    try {
      await page.goto(`${BASE_URL}/technologies/mermaid`, {
        waitUntil: "domcontentloaded",
      });
      await page.waitForFunction(
        () => document.querySelectorAll(".mermaid-diagram svg").length === 3,
        { timeout: 20_000 },
      );

      const diagrams = await page.$$eval(".mermaid-diagram", (containers) =>
        containers.map((container) => {
          const svg = container.querySelector("svg");
          const bounds = svg?.getBoundingClientRect();

          return {
            error: container.querySelector("pre")?.textContent ?? null,
            height: bounds?.height ?? 0,
            text: svg?.textContent ?? "",
            viewBox: svg?.getAttribute("viewBox") ?? "",
            width: bounds?.width ?? 0,
          };
        }),
      );

      expect(pageErrors).toEqual([]);
      expect(diagrams).toHaveLength(3);
      expect(diagrams.map((diagram) => diagram.error)).toEqual([
        null,
        null,
        null,
      ]);

      for (const diagram of diagrams) {
        expect(diagram.viewBox).toMatch(
          /^\s*[-\d.]+\s+[-\d.]+\s+[\d.]+\s+[\d.]+\s*$/,
        );
        expect(diagram.width).toBeGreaterThan(100);
        expect(diagram.height).toBeGreaterThan(40);
      }

      expect(diagrams[0]?.text).toContain("Is it working?");
      expect(diagrams[0]?.text).toContain("Ship it!");
      expect(diagrams[1]?.text).toContain("POST /api/data");
      expect(diagrams[1]?.text).toContain("201 Created");
      expect(diagrams[2]?.text).toContain("Draft");
      expect(diagrams[2]?.text).toContain("Published");
    } finally {
      await page.close();
    }
  }, 30_000);

  it.each([
    ["the technology demo", "/technologies/recharts", 3],
    ["the wealth article", "/blog/2020-09-27-how-to-build-wealth", 4],
  ])(
    "lazy-loads charts for %s",
    async (_label, path, expectedCharts) => {
      const page = await browser.newPage();
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(String(error)));

      try {
        await page.goto(`${BASE_URL}${path}`, {
          waitUntil: "domcontentloaded",
        });
        await page.waitForFunction(
          (chartCount) =>
            document.querySelectorAll(".recharts-responsive-container")
              .length === chartCount,
          { timeout: 20_000 },
          expectedCharts,
        );

        const chartSizes = await page.$$eval(
          ".recharts-responsive-container",
          (containers) =>
            containers.map((container) => {
              const bounds = container.getBoundingClientRect();
              return { height: bounds.height, width: bounds.width };
            }),
        );

        expect(pageErrors).toEqual([]);
        expect(chartSizes).toHaveLength(expectedCharts);
        for (const chart of chartSizes) {
          expect(chart.width).toBeGreaterThan(100);
          expect(chart.height).toBeGreaterThan(100);
        }
      } finally {
        await page.close();
      }
    },
    30_000,
  );
});
