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
        "cypher",
      ],
    });
  }
  return highlighter;
}

export async function highlight(code: string, lang: string) {
  const highlighter = await getShikiHighlighter();

  // Graceful fallback to plain text for unknown languages
  const loadedLangs = highlighter.getLoadedLanguages();
  const safeLang = loadedLangs.includes(lang) ? lang : "text";

  const html = highlighter.codeToHtml(code, {
    lang: safeLang,
    themes: {
      light: "github-light",
      dark: "github-dark",
    },
    defaultColor: false,
    transformers: [
      {
        name: "data-language",
        pre(node) {
          node.properties["data-language"] = lang;
        },
        code(node) {
          node.properties["data-language"] = lang;
        },
      },
    ],
  });

  return html;
}
