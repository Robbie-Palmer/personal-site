import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const contentDirectory = path.join(process.cwd(), "content/blog");

export interface BlogPostMetadata {
  title: string;
  description: string;
  date: string;
  tags: string[];
  slug: string;
}

export interface BlogPost extends BlogPostMetadata {
  content: string;
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

  return {
    slug,
    title: data.title || "Untitled",
    description: data.description || "",
    date: data.date || "",
    tags: data.tags || [],
    content,
  };
}

export function getAllPosts(): BlogPostMetadata[] {
  const slugs = getAllPostSlugs();
  const posts = slugs.map((slug) => {
    const post = getPostBySlug(slug);
    const { content, ...metadata } = post;
    return metadata;
  });

  return posts.sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateB - dateA; // Descending order (newest first)
  });
}
