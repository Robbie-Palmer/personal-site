import { describe, expect, it } from "vitest";
import {
  markdownUrl,
  mdxToAgentMarkdown,
  renderPage,
} from "@/lib/content/agent-markdown";

describe("mdxToAgentMarkdown", () => {
  it("passes plain markdown through, including GFM tables", () => {
    const mdx = [
      "# Heading",
      "",
      "Some **bold** prose with a [link](https://example.com).",
      "",
      "| a | b |",
      "| - | - |",
      "| 1 | 2 |",
    ].join("\n");
    const result = mdxToAgentMarkdown(mdx);
    expect(result).toContain("# Heading");
    expect(result).toContain("**bold**");
    expect(result).toContain("| 1 | 2 |");
  });

  it("strips ESM imports", () => {
    const mdx = 'import { Mermaid } from "@/components/mermaid";\n\nHello.';
    const result = mdxToAgentMarkdown(mdx);
    expect(result).not.toContain("import");
    expect(result).toContain("Hello.");
  });

  it("converts Mermaid components to mermaid code blocks", () => {
    const mdx = "<Mermaid chart={`graph TD\n  A --> B`} />";
    const result = mdxToAgentMarkdown(mdx);
    expect(result).toContain("```mermaid");
    expect(result).toContain("A --> B");
  });

  it("replaces childless components with a placeholder", () => {
    const result = mdxToAgentMarkdown("Before\n\n<MermaidDemo />\n\nAfter");
    expect(result).toContain(
      "(Interactive MermaidDemo component — view it on the HTML page)",
    );
    expect(result).not.toContain("<MermaidDemo");
  });

  it("unwraps wrapper components, keeping inner content", () => {
    const mdx = "<MyParagraph>\n  Inner *content* stays\n</MyParagraph>";
    const result = mdxToAgentMarkdown(mdx);
    expect(result).toContain("Inner *content* stays");
    expect(result).not.toContain("MyParagraph");
  });

  it("resolves image sources through the provided resolver", () => {
    const mdx = '<img src="blog/my-image-2025-12-14" alt="An image" />';
    const result = mdxToAgentMarkdown(mdx, {
      resolveImageUrl: (src) => `https://images.example.com/${src}`,
    });
    expect(result).toContain(
      "![An image](https://images.example.com/blog/my-image-2025-12-14)",
    );
  });

  it("drops images when the resolver returns null", () => {
    const mdx = 'Before\n\n<img src="blog/my-image-2025-12-14" />\n\nAfter';
    const result = mdxToAgentMarkdown(mdx, { resolveImageUrl: () => null });
    expect(result).not.toContain("img");
    expect(result).toContain("Before");
    expect(result).toContain("After");
  });

  it("leaves fenced code blocks containing JSX-like generics untouched", () => {
    const mdx = "```ts\ntechnologies: Map<TechnologySlug, Technology>;\n```";
    const result = mdxToAgentMarkdown(mdx);
    expect(result).toContain("Map<TechnologySlug, Technology>");
  });
});

describe("renderPage", () => {
  it("renders title, description, canonical link, facts, and footer", () => {
    const page = renderPage(
      {
        title: "Projects",
        htmlPath: "/projects",
        description: "All my projects",
        facts: [["Status", "live"]],
      },
      "Body content",
    );
    expect(page).toContain("# Projects");
    expect(page).toContain("> All my projects");
    expect(page).toContain("- HTML version: https://robbiepalmer.me/projects");
    expect(page).toContain("- Status: live");
    expect(page).toContain("Body content");
    expect(page).toContain("https://robbiepalmer.me/llms.txt");
  });
});

describe("markdownUrl", () => {
  it("maps the home page to /index.md", () => {
    expect(markdownUrl("/")).toBe("https://robbiepalmer.me/index.md");
  });

  it("appends .md to other paths", () => {
    expect(markdownUrl("/projects/recipe-site")).toBe(
      "https://robbiepalmer.me/projects/recipe-site.md",
    );
  });
});
