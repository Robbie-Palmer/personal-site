import { describe, expect, it } from "vitest";
import { formatADRIndex, normalizeADRTitle } from "@/lib/domain/adr/adr";
import { summarizeMarkdown } from "@/lib/domain/adr/adrQueries";

describe("ADR utilities", () => {
  it("formats ADR indexes as zero-padded 3-digit values", () => {
    expect(formatADRIndex(0)).toBe("000");
    expect(formatADRIndex(9)).toBe("009");
    expect(formatADRIndex(123)).toBe("123");
  });

  it("normalizes ADR title by removing prefixed ADR number", () => {
    expect(normalizeADRTitle("ADR 014: SSG")).toBe("SSG");
    expect(normalizeADRTitle("ADR 025: Content Graph Indexes")).toBe(
      "Content Graph Indexes",
    );
    expect(normalizeADRTitle("Use React")).toBe("Use React");
  });

  it("summarizes markdown to clean plain text", () => {
    const markdown = `# Heading

**Bold** with [link](https://example.com), \`inline code\`, and > quoted text.

Second paragraph.`;

    expect(summarizeMarkdown(markdown)).toBe(
      "Bold with link, inline code, and quoted text.",
    );
  });
});
