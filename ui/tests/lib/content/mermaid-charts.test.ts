import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import mermaid from "mermaid";
import { describe, expect, it } from "vitest";

const CONTENT_ROOT = join(process.cwd(), "content");

// Mermaid renders client-side, so a malformed chart only surfaces as an error
// box in the browser — nothing in the build or the type checker catches it.
const CHART_PATTERN = /<Mermaid[\s\S]*?chart=\{`([\s\S]*?)`\}/g;

function extractCharts(source: string): string[] {
  return Array.from(source.matchAll(CHART_PATTERN))
    .map((match) => match[1])
    .filter((chart) => chart !== undefined);
}

function contentFiles(): string[] {
  return readdirSync(CONTENT_ROOT, { recursive: true, encoding: "utf8" })
    .filter((entry) => entry.endsWith(".mdx"))
    .map((entry) => join(CONTENT_ROOT, entry));
}

describe("Mermaid charts in MDX content", () => {
  it("parse without error", async () => {
    mermaid.initialize({ startOnLoad: false });

    const failures: string[] = [];
    let charts = 0;

    for (const file of contentFiles()) {
      for (const chart of extractCharts(readFileSync(file, "utf8"))) {
        charts += 1;
        try {
          await mermaid.parse(chart);
        } catch (error) {
          failures.push(`${relative(CONTENT_ROOT, file)}: ${error}`);
        }
      }
    }

    expect(failures).toEqual([]);
    expect(charts).toBeGreaterThan(0);
  });
});
