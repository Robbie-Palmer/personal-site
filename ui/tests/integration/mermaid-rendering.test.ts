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
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
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
      const initialAppearance = await page.$eval(
        ".pitch-deck .reveal",
        (deck) => ({
          background: getComputedStyle(deck).backgroundColor,
          headingColor: getComputedStyle(
            deck.querySelector("section.present h1") as HTMLElement,
          ).color,
        }),
      );
      expect(initialAppearance).toEqual({
        background: "rgb(9, 10, 9)",
        headingColor: "rgb(247, 245, 239)",
      });
      expect(
        await page.$eval('a[href="/technologies/revealdotjs/deck"]', (link) =>
          link.textContent?.trim(),
        ),
      ).toBe("Present");
      await page.waitForFunction(
        () =>
          document
            .querySelector(".pitch-deck__position")
            ?.textContent?.trim() === "Slide 1 of 6",
      );

      await page.click('button[title="Enter fullscreen"]');
      await page.waitForFunction(
        () => document.fullscreenElement?.classList.contains("pitch-deck"),
        { timeout: 10_000 },
      );
      const fullscreenLayout = await page.$eval(
        ".pitch-deck:fullscreen",
        (deck) => {
          const stage = deck.querySelector<HTMLElement>(".pitch-deck__stage");
          return {
            deckHeight: deck.getBoundingClientRect().height,
            display: getComputedStyle(deck).display,
            stageHeight: stage?.getBoundingClientRect().height ?? 0,
          };
        },
      );
      expect(fullscreenLayout.display).toBe("flex");
      expect(fullscreenLayout.deckHeight).toBeGreaterThan(500);
      expect(fullscreenLayout.stageHeight).toBeGreaterThan(300);
      await page.click('button[title="Exit fullscreen"]');
      await page.waitForFunction(() => document.fullscreenElement === null);

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
      expect(diagramSize.height).toBeGreaterThan(30);
      const nodeLabels = await page.$$eval(
        ".pitch-deck section.present .mermaid-diagram .nodeLabel p",
        (labels) =>
          labels.map((label) => ({
            fontSize: getComputedStyle(label).fontSize,
            text: label.textContent,
          })),
      );
      expect(nodeLabels.length).toBeGreaterThan(0);
      expect(nodeLabels.every((label) => label.fontSize === "16px")).toBe(true);
      expect(nodeLabels.map((label) => label.text).join(" ")).toContain(
        "MDX source",
      );

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

  it("loads the embedded project deck fully styled and counted", async () => {
    const page = await browser.newPage();
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));

    try {
      await page.goto(`${BASE_URL}/projects/agentic-code-review`, {
        waitUntil: "domcontentloaded",
      });
      await page.waitForSelector(".pitch-deck .reveal.ready", {
        timeout: 20_000,
      });
      await page.waitForFunction(
        () =>
          document
            .querySelector(".pitch-deck__position")
            ?.textContent?.trim() === "Slide 1 of 8",
      );

      const deck = await page.$eval(".pitch-deck", (element) => {
        const slide = element.querySelector<HTMLElement>(".pitch-slide");
        const reveal = element.querySelector<HTMLElement>(".reveal");
        const heading =
          element.querySelector<HTMLElement>("section.present h1");
        return {
          background: getComputedStyle(element).backgroundColor,
          headingColor: heading ? getComputedStyle(heading).color : "",
          paddingTop: slide ? getComputedStyle(slide).paddingTop : "",
          revealBackground: reveal
            ? getComputedStyle(reveal).backgroundColor
            : "",
          slides: element.querySelectorAll(".slides > section").length,
        };
      });

      expect(deck).toEqual({
        background: "rgb(9, 10, 9)",
        headingColor: "rgb(247, 245, 239)",
        paddingTop: "72px",
        revealBackground: "rgb(9, 10, 9)",
        slides: 8,
      });

      expect(pageErrors).toEqual([]);
    } finally {
      await page.close();
    }
  }, 30_000);

  it("uses a readable portrait deck and compact controls on phones", async () => {
    const page = await browser.newPage();
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));

    try {
      await page.setViewport({ width: 390, height: 844 });
      await page.goto(`${BASE_URL}/projects/agentic-code-review/deck`, {
        waitUntil: "domcontentloaded",
      });
      await page.waitForSelector(".pitch-deck .reveal.ready.reveal-scroll", {
        timeout: 20_000,
      });
      await page.waitForFunction(
        () =>
          document.querySelectorAll(".pitch-deck .scroll-page").length === 8 &&
          document
            .querySelector('button[title="Toggle scroll view"]')
            ?.textContent?.trim() === "Slides",
      );

      const mobileLayout = await page.evaluate(() => {
        const deck = document.querySelector<HTMLElement>(".pitch-deck");
        const reveal = document.querySelector<HTMLElement>(
          ".pitch-deck .reveal",
        );
        const topbar = document.querySelector<HTMLElement>(
          ".pitch-deck__topbar",
        );
        const controls = document.querySelector<HTMLElement>(
          ".pitch-deck__controls",
        );
        const stage = document.querySelector<HTMLElement>(".pitch-deck__stage");
        const toolButtons = Array.from(
          document.querySelectorAll<HTMLElement>(
            ".pitch-deck__tools button, .pitch-deck__tools a",
          ),
        );

        return {
          controlsHeight: controls?.getBoundingClientRect().height ?? 0,
          deckHeight: deck?.getBoundingClientRect().height ?? 0,
          deckWidth: deck?.getBoundingClientRect().width ?? 0,
          documentWidth: document.documentElement.scrollWidth,
          slideHeight: reveal
            ? getComputedStyle(reveal).getPropertyValue("--slide-height")
            : "",
          slideWidth: reveal
            ? getComputedStyle(reveal).getPropertyValue("--slide-width")
            : "",
          stageHeight: stage?.getBoundingClientRect().height ?? 0,
          toolSizes: toolButtons.map((button) => {
            const bounds = button.getBoundingClientRect();
            return { height: bounds.height, width: bounds.width };
          }),
          topbarHeight: topbar?.getBoundingClientRect().height ?? 0,
        };
      });

      expect(mobileLayout.slideWidth).toBe("720px");
      expect(mobileLayout.slideHeight).toBe("960px");
      expect(mobileLayout.deckWidth).toBeLessThanOrEqual(390);
      expect(mobileLayout.deckHeight).toBeLessThanOrEqual(844);
      expect(mobileLayout.documentWidth).toBeLessThanOrEqual(390);
      expect(mobileLayout.stageHeight).toBeGreaterThan(600);
      expect(mobileLayout.topbarHeight).toBeLessThanOrEqual(60);
      expect(mobileLayout.controlsHeight).toBeLessThanOrEqual(60);
      expect(
        mobileLayout.toolSizes.every(
          (size) => size.width >= 40 && size.height >= 40,
        ),
      ).toBe(true);
      expect(pageErrors).toEqual([]);
    } finally {
      await page.close();
    }
  }, 30_000);

  it("opens working speaker previews and prepares the focused deck for PDF", async () => {
    const page = await browser.newPage();

    try {
      await page.goto(`${BASE_URL}/projects/agentic-code-review/deck`, {
        waitUntil: "domcontentloaded",
      });
      await page.waitForSelector(".pitch-deck .reveal.ready", {
        timeout: 20_000,
      });

      await page.click('button[title="Slide overview"]');
      await page.waitForFunction(
        () =>
          document.querySelector(".pitch-deck .reveal.overview") &&
          Array.from(
            document.querySelectorAll<HTMLElement>(
              ".pitch-deck .slides > section",
            ),
          ).every(
            (slide) =>
              !slide.hidden && getComputedStyle(slide).display === "block",
          ),
      );

      await page.click('button[title="Toggle scroll view"]');
      await page.waitForFunction(
        () =>
          document.querySelector(".pitch-deck .reveal-scroll") &&
          document.querySelectorAll(".pitch-deck .scroll-page").length === 8 &&
          document
            .querySelector('button[title="Toggle scroll view"]')
            ?.textContent?.trim() === "Slides",
      );
      const scrollView = await page.$eval(
        ".pitch-deck .reveal-scroll",
        (viewport) => ({
          clientHeight: viewport.clientHeight,
          pages: viewport.querySelectorAll(".scroll-page").length,
          scrollHeight: viewport.scrollHeight,
        }),
      );
      expect(scrollView.pages).toBe(8);
      expect(scrollView.scrollHeight).toBeGreaterThan(scrollView.clientHeight);

      await page.click('button[title="Toggle scroll view"]');
      await page.waitForFunction(
        () =>
          !document.querySelector(".pitch-deck .reveal-scroll") &&
          document.querySelectorAll(".pitch-deck .slides > section").length ===
            8,
      );

      const speakerTarget = browser.waitForTarget(
        (target) => target.opener() === page.target(),
        { timeout: 10_000 },
      );
      await page.click('button[title="Speaker view"]');
      const speakerPage = await (await speakerTarget).page();
      expect(speakerPage).not.toBeNull();
      await speakerPage?.waitForSelector("#current-slide iframe", {
        timeout: 10_000,
      });
      await speakerPage?.waitForFunction(
        () => {
          const frame = document.querySelector<HTMLIFrameElement>(
            "#current-slide iframe",
          );
          return frame?.contentDocument?.querySelector(
            ".pitch-deck .reveal.ready section.present h1",
          )?.textContent;
        },
        { timeout: 20_000 },
      );
      const speakerHeading = await speakerPage?.$eval(
        "#current-slide iframe",
        (frame) =>
          (frame as HTMLIFrameElement).contentDocument?.querySelector(
            ".pitch-deck section.present h1",
          )?.textContent,
      );
      expect(speakerHeading).toContain("Code arrives faster");
      await speakerPage?.close();
    } finally {
      await page.close();
    }

    const printPage = await browser.newPage();
    try {
      await printPage.evaluateOnNewDocument(() => {
        Object.defineProperty(window, "print", {
          configurable: true,
          value: () => {
            document.documentElement.dataset.printDialogOpened = "true";
          },
        });
      });
      await printPage.goto(
        `${BASE_URL}/projects/agentic-code-review/deck?print-pdf`,
        { waitUntil: "domcontentloaded" },
      );
      await printPage.waitForFunction(
        () =>
          document.documentElement.classList.contains("reveal-print") &&
          document.querySelectorAll(".pdf-page").length === 8 &&
          document.documentElement.dataset.printDialogOpened === "true",
        { timeout: 20_000 },
      );

      const printLayout = await printPage.evaluate(() => ({
        controls: getComputedStyle(
          document.querySelector(".pitch-deck__controls") as HTMLElement,
        ).display,
        pages: document.querySelectorAll(".pdf-page").length,
        topbar: getComputedStyle(
          document.querySelector(".pitch-deck__topbar") as HTMLElement,
        ).display,
      }));
      expect(printLayout).toEqual({
        controls: "none",
        pages: 8,
        topbar: "none",
      });
    } finally {
      await printPage.close();
    }
  }, 60_000);

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
