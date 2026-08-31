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

  it("runs the reveal.js integration fixture on its technology page", async () => {
    const page = await browser.newPage();
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));

    try {
      await page.goto(`${BASE_URL}/technologies/revealdotjs`, {
        waitUntil: "domcontentloaded",
      });
      await page.waitForSelector(".pitch-deck .reveal.ready", {
        timeout: 20_000,
      });

      const fixture = await page.evaluate(() => ({
        codeBlocks: document.querySelectorAll('code[data-language="ts"]')
          .length,
        fragments: document.querySelectorAll(".pitch-deck .fragment").length,
        highlightedLines: document.querySelectorAll(
          'code[data-language="ts"] [data-highlighted-line]',
        ).length,
        notes: document.querySelectorAll(".pitch-deck aside.notes").length,
        slides: document.querySelectorAll(".pitch-deck .slides > section")
          .length,
      }));

      expect(fixture).toEqual({
        codeBlocks: 1,
        fragments: 3,
        highlightedLines: 3,
        notes: 2,
        slides: 6,
      });

      await page.click('button[aria-label="Next slide"]');
      await page.waitForFunction(
        () =>
          document.querySelector(".pitch-deck section.present h2")
            ?.textContent === "Mermaid remains a live component",
      );
      await page.waitForSelector(
        ".pitch-deck section.present .mermaid-diagram svg",
      );

      const diagramSize = await page.$eval(
        ".pitch-deck section.present .mermaid-diagram svg",
        (svg) => {
          const bounds = svg.getBoundingClientRect();
          return { height: bounds.height, width: bounds.width };
        },
      );
      expect(diagramSize.width).toBeGreaterThan(100);
      expect(diagramSize.height).toBeGreaterThan(40);

      await page.click('button[aria-label="Next slide"]');
      await page.click('button[aria-label="Next slide"]');
      await page.click('button[aria-label="Next slide"]');
      await page.click('button[aria-label="Next slide"]');
      await page.click('button[aria-label="Next slide"]');

      const visibleFragments = await page.$$eval(
        ".pitch-deck section.present .fragment.visible",
        (fragments) =>
          fragments.map((fragment) =>
            fragment.getAttribute("data-fragment-index"),
          ),
      );
      expect(visibleFragments).toEqual(["0", "1", "2"]);

      await page.click('button[aria-label="Next slide"]');
      await page.waitForFunction(
        () =>
          document.querySelector(".pitch-deck section.present h2")
            ?.textContent === "React state stays interactive",
      );
      await page.click(".pitch-deck section.present button:last-child");

      const liveControl = await page.evaluate(() => ({
        count: document.querySelector(
          ".pitch-deck section.present .review-depth-demo__count strong",
        )?.textContent,
        selected: Array.from(
          document.querySelectorAll<HTMLButtonElement>(
            ".pitch-deck section.present .review-depth-demo button",
          ),
        ).find((button) => button.getAttribute("aria-pressed") === "true")
          ?.textContent,
      }));
      expect(liveControl).toEqual({ count: "3", selected: "Sensitive" });
      expect(pageErrors).toEqual([]);
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
