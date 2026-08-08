import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import mermaid from "mermaid";
import { describe, expect, it } from "vitest";

// Resolved from this file, not process.cwd(): under coverage the vitest root is
// the repo root, so cwd depends on where the run was launched from.
const CONTENT_ROOT = join(import.meta.dirname, "../../../content");

// Mermaid renders client-side, so a malformed chart only surfaces as an error
// box in the browser — nothing in the build or the type checker catches it.
// [^>]* keeps the match inside a single tag, so props may precede `chart` but a
// propless <Mermaid /> can't pair with a later element's chart.
const CHART_PATTERN = /<Mermaid\b[^>]*?chart=\{`([\s\S]*?)`\}/g;
const TAG_PATTERN = /<Mermaid\b/g;

function extractCharts(source: string): string[] {
  return Array.from(source.matchAll(CHART_PATTERN))
    .map((match) => match[1])
    .filter((chart) => chart !== undefined);
}

// Prose that documents the component (`<Mermaid chart={...} />` in a code span)
// isn't rendered, so it must not count as a chart the test failed to read.
// Fences first — they are backtick runs the inline-span pattern would misread.
function stripCode(source: string): string {
  return source.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "");
}

function countTags(source: string): number {
  return Array.from(stripCode(source).matchAll(TAG_PATTERN)).length;
}

function contentFiles(): string[] {
  return readdirSync(CONTENT_ROOT, { recursive: true, encoding: "utf8" })
    .filter((entry) => entry.endsWith(".mdx"))
    .map((entry) => join(CONTENT_ROOT, entry));
}

describe("Mermaid charts in MDX content", () => {
  it("parse without error", async () => {
    mermaid.initialize({ startOnLoad: false });

    const files = contentFiles();
    expect(files.length).toBeGreaterThan(0);

    const failures: string[] = [];
    const skipped: string[] = [];
    let charts = 0;

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const extracted = extractCharts(source);
      const name = relative(CONTENT_ROOT, file);

      // A chart the pattern can't read would otherwise go unchecked silently.
      if (extracted.length !== countTags(source)) {
        skipped.push(
          `${name}: ${countTags(source)} <Mermaid> tags, ${extracted.length} charts extracted`,
        );
      }

      for (const chart of extracted) {
        charts += 1;
        try {
          await mermaid.parse(chart);
        } catch (error) {
          failures.push(`${name}: ${error}`);
        }
      }
    }

    expect(skipped).toEqual([]);
    expect(failures).toEqual([]);
    expect(charts).toBeGreaterThan(0);
  });
});
