import { createHighlighter, type Highlighter } from "shiki";

// Store highlighter on globalThis to survive HMR in development
const globalForShiki = globalThis as unknown as {
  shikiHighlighter: Highlighter | undefined;
};

async function getShikiHighlighter() {
  if (!globalForShiki.shikiHighlighter) {
    globalForShiki.shikiHighlighter = await createHighlighter({
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
  return globalForShiki.shikiHighlighter;
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
