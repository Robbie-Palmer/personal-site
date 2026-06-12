import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Validates the agent-friendly Markdown twins generated into out/ by
 * scripts/generate-agent-markdown.ts (run as part of `pnpm build`).
 */

const OUT_DIR = path.join(process.cwd(), "out");

function read(relativePath: string): string {
  return fs.readFileSync(path.join(OUT_DIR, relativePath), "utf-8");
}

describe("agent markdown generation", () => {
  it("generates markdown twins for the main pages", () => {
    for (const file of [
      "index.md",
      "experience.md",
      "projects.md",
      "blog.md",
      "llms.txt",
      "llms-full.txt",
      "_headers",
    ]) {
      expect(fs.existsSync(path.join(OUT_DIR, file)), file).toBe(true);
    }
  });

  it("includes the building philosophy in projects.md", () => {
    const projects = read("projects.md");
    expect(projects).toContain("# Building Philosophy");
    expect(projects).toContain("## Short Feedback Loops");
  });

  it("generates a markdown twin for every project HTML page", () => {
    const projectDirs = fs
      .readdirSync(path.join(OUT_DIR, "projects"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory());
    for (const dir of projectDirs) {
      expect(
        fs.existsSync(path.join(OUT_DIR, "projects", `${dir.name}.md`)),
        `projects/${dir.name}.md`,
      ).toBe(true);
    }
  });

  it("links every llms.txt entry to a generated file", () => {
    const llms = read("llms.txt");
    const urls = [...llms.matchAll(/\(https:\/\/robbiepalmer\.me(\/[^)]+)\)/g)]
      .map((match) => match[1])
      .filter((urlPath): urlPath is string =>
        Boolean(urlPath?.endsWith(".md")),
      );
    expect(urls.length).toBeGreaterThan(10);
    for (const urlPath of urls) {
      expect(fs.existsSync(path.join(OUT_DIR, urlPath.slice(1))), urlPath).toBe(
        true,
      );
    }
  });

  it("contains no leftover MDX syntax in generated markdown", () => {
    const sample = ["projects.md", "blog.md", "experience.md"];
    for (const file of sample) {
      const content = read(file);
      expect(content, file).not.toMatch(/^import .* from/m);
    }
  });

  it("advertises markdown alternates for entry pages in _headers", () => {
    const headers = read("_headers");
    expect(headers).toContain("/projects");
    expect(headers).toContain(
      'Link: <https://robbiepalmer.me/projects.md>; rel="alternate"; type="text/markdown"',
    );
    const ruleCount = (headers.match(/^ {2}Link:/gm) ?? []).length;
    expect(ruleCount).toBeLessThanOrEqual(100);
  });
});
