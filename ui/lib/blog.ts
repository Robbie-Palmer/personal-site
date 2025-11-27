import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { Root } from "mdast";
import { toString as mdastToString } from "mdast-util-to-string";
import readingTime from "reading-time";
import { remark } from "remark";
import remarkMdx from "remark-mdx";
import stripMarkdown from "strip-markdown";
import { visit } from "unist-util-visit";

const contentDirectory = path.join(process.cwd(), "content/blog");

/**
 * Extracts readable text from MDX content for reading time calculation.
 * Removes JSX components and code blocks to get only prose content.
 */
function extractReadableText(mdxContent: string): string {
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
  image: string;
  imageAlt: string;
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

  if (!data.image || typeof data.image !== "string") {
    throw new Error(`Post ${slug} is missing required field: image`);
  }

  // Validate image field - must be a CF Images ID with CalVer versioning
  // Format: 'blog/{name}-{YYYYMMDD}' (no extension)
  // Example: 'blog/hero-image-20251127'
  const imageIdPattern = /^blog\/[a-z0-9_-]+-\d{8}$/;
  if (!imageIdPattern.test(data.image)) {
    throw new Error(
      `Post ${slug}: Invalid image ID format. ` +
      `Expected 'blog/{name}-YYYYMMDD' (e.g., 'blog/hero-image-20251127'). ` +
      `Got: '${data.image}'`,
    );
  }

  // Extract and validate the date portion
  const dateMatch = data.image.match(/-(\d{8})$/);
  if (dateMatch) {
    const dateStr = dateMatch[1];
    const year = Number.parseInt(dateStr.substring(0, 4), 10);
    const month = Number.parseInt(dateStr.substring(4, 6), 10);
    const day = Number.parseInt(dateStr.substring(6, 8), 10);

    // Basic date validation
    if (year < 2020 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
      throw new Error(
        `Post ${slug}: Invalid date in image ID '${data.image}'. ` +
        `Date portion '${dateStr}' is not a valid calendar date.`,
      );
    }
  }

  if (!data.imageAlt || typeof data.imageAlt !== "string") {
    throw new Error(`Post ${slug} is missing required field: imageAlt`);
  }

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
    image: data.image,
    imageAlt: data.imageAlt,
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
