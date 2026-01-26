import type { Root } from "mdast";
import { toString as mdastToString } from "mdast-util-to-string";
import readingTime from "reading-time";
import { remark } from "remark";
import remarkMdx from "remark-mdx";
import stripMarkdown from "strip-markdown";
import { visit } from "unist-util-visit";

/**
 * Extracts readable text from MDX content for reading time calculation.
 * Removes JSX components and code blocks to get only prose content.
 */
export function extractReadableText(mdxContent: string): string {
  function removeJSX() {
    return (tree: Root) => {
      visit(tree, (node, index, parent) => {
        const shouldRemove =
          node.type === "mdxJsxFlowElement" ||
          node.type === "mdxJsxTextElement" ||
          node.type === "mdxjsEsm" ||
          node.type === "mdxFlowExpression" ||
          node.type === "mdxTextExpression" ||
          node.type === "code";

        if (shouldRemove && parent && typeof index === "number") {
          parent.children.splice(index, 1);
          return index;
        }
      });
    };
  }

  try {
    const processor = remark().use(remarkMdx).use(removeJSX).use(stripMarkdown);
    const tree = processor.parse(mdxContent);
    const transformedTree = processor.runSync(tree);
    return mdastToString(transformedTree);
  } catch (error) {
    console.warn("Failed to parse MDX for reading time:", error);
    return mdxContent;
  }
}

export function calculateReadingTime(content: string): string {
  const readableText = extractReadableText(content);
  return readingTime(readableText).text;
}
