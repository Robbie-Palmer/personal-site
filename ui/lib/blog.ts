import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import readingTime from "reading-time";
import { remark } from "remark";
import remarkMdx from "remark-mdx";
import stripMarkdown from "strip-markdown";
import { toString } from "mdast-util-to-string";
import { visit } from "unist-util-visit";
import type { Root } from "mdast";

const contentDirectory = path.join(process.cwd(), "content/blog");

/**
 * Extracts readable text from MDX content for reading time calculation.
 * Removes JSX components (including Mermaid diagrams) and code blocks
 * to get only the actual prose content.
 */
function extractReadableText(mdxContent: string): string {
  // Remove JSX elements using a plugin
  function removeJSX() {
    return (tree: Root) => {
      visit(tree, (node, index, parent) => {
        // Remove MDX JSX elements (like <Mermaid />)
        if (
          node.type === "mdxJsxFlowElement" ||
          node.type === "mdxJsxTextElement"
        ) {
          if (parent && typeof index === "number") {
            parent.children.splice(index, 1);
            return index;
          }
        }
        // Remove code blocks - they're not prose to read
        if (node.type === "code") {
          if (parent && typeof index === "number") {
            parent.children.splice(index, 1);
            return index;
          }
        }
      });
    };
  }

  try {
    const processed = remark()
      .use(remarkMdx) // Parse MDX syntax
      .use(removeJSX) // Remove JSX components and code blocks
      .use(stripMarkdown) // Remove markdown formatting
      .processSync(mdxContent);

    // Extract plain text from the processed AST
    return toString(processed);
  } catch (error) {
    // If parsing fails, fall back to original content
    console.warn("Failed to parse MDX for reading time:", error);
    return mdxContent;
  }
}

export interface BlogPost {
  title: string;
  description: string;
  date: string;
  updated?: string;
  tags: string[];
  canonicalUrl?: string;
  slug: string;
  content: string;
  readingTime: string;
}

export function getAllPostSlugs(): string[] {
  if (!fs.existsSync(contentDirectory)) {
    return [];
  }
  const files = fs.readdirSync(contentDirectory);
  return files
    .filter((file) => file.endsWith(".mdx") && !file.startsWith("."))
    .map((file) => file.replace(/\.mdx$/, ""));
}

export function getPostBySlug(slug: string): BlogPost {
  // Validate slug: only lowercase letters, numbers, hyphens, and underscores
  if (!slug || !/^[a-z0-9_-]+$/.test(slug)) {
    throw new Error("Invalid slug");
  }

  const fullPath = path.join(contentDirectory, `${slug}.mdx`);

  // Ensure the resolved path is within contentDirectory using path.relative
  const normalizedPath = path.resolve(fullPath);
  const normalizedDir = path.resolve(contentDirectory);
  const relativePath = path.relative(normalizedDir, normalizedPath);

  // Security checks:
  // 1. relativePath must not start with '..' (going outside the directory)
  // 2. relativePath must not be an absolute path (completely outside)
  // 3. Must have .mdx extension
  if (
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath) ||
    !relativePath.endsWith(".mdx")
  ) {
    throw new Error("Invalid slug");
  }

  const fileContents = fs.readFileSync(fullPath, "utf8");
  const { data, content } = matter(fileContents);

  // Validate required frontmatter fields
  if (!data.title || typeof data.title !== "string") {
    throw new Error(`Post ${slug} is missing required field: title`);
  }

  if (!data.description || typeof data.description !== "string") {
    throw new Error(`Post ${slug} is missing required field: description`);
  }

  if (!data.date || typeof data.date !== "string") {
    throw new Error(`Post ${slug} is missing required field: date`);
  }

  // Validate date is actually a valid date
  const dateTimestamp = new Date(data.date).getTime();
  if (Number.isNaN(dateTimestamp)) {
    throw new Error(`Post ${slug} has invalid date: ${data.date}`);
  }

  if (!Array.isArray(data.tags)) {
    throw new Error(
      `Post ${slug} is missing required field: tags (must be an array)`,
    );
  }

  // Validate optional updated field if present
  if (data.updated !== undefined) {
    if (typeof data.updated !== "string") {
      throw new Error(
        `Post ${slug} has invalid updated field: must be a string`,
      );
    }
    const updatedTimestamp = new Date(data.updated).getTime();
    if (Number.isNaN(updatedTimestamp)) {
      throw new Error(`Post ${slug} has invalid updated date: ${data.updated}`);
    }
  }

  // Validate optional canonicalUrl field if present
  if (data.canonicalUrl !== undefined) {
    if (typeof data.canonicalUrl !== "string") {
      throw new Error(
        `Post ${slug} has invalid canonicalUrl field: must be a string`,
      );
    }
    // Basic URL validation
    try {
      new URL(data.canonicalUrl);
    } catch {
      throw new Error(
        `Post ${slug} has invalid canonicalUrl: ${data.canonicalUrl}`,
      );
    }
  }

  // Extract readable text (removing JSX components and code blocks)
  // before calculating reading time
  const readableText = extractReadableText(content);
  const stats = readingTime(readableText);

  return {
    slug,
    title: data.title,
    description: data.description,
    date: data.date,
    updated: data.updated,
    tags: data.tags,
    canonicalUrl: data.canonicalUrl,
    content,
    readingTime: stats.text,
  };
}

export function getAllPosts(): BlogPost[] {
  const slugs = getAllPostSlugs();
  const posts = slugs.map((slug) => getPostBySlug(slug));

  return posts.sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateB - dateA; // Descending order (newest first)
  });
}
