import { createHighlighter, type Highlighter } from "shiki";

// Reuse highlighter instance
let highlighter: Highlighter | null = null;

async function getShikiHighlighter() {
  if (!highlighter) {
    highlighter = await createHighlighter({
      themes: ["github-dark", "github-light"],
      langs: [
        "javascript",
        "typescript",
        "tsx",
        "jsx",
        "css",
        "html",
        "json",
        "bash",
        "python",
        "go",
        "yaml",
        "markdown",
        "sql",
        "java",
        "csharp",
        "rust",
      ],
    });
  }
  return highlighter;
}

export async function highlight(code: string, lang: string) {
  const highlighter = await getShikiHighlighter();

  const html = highlighter.codeToHtml(code, {
    lang,
    themes: {
      light: "github-light",
      dark: "github-dark",
    },
    defaultColor: false,
  });

  return html;
}
