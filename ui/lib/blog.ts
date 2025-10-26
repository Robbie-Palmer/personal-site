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

  // Ensure the resolved path is within contentDirectory
  const normalizedPath = path.resolve(fullPath);
  const normalizedDir = path.resolve(contentDirectory);
  if (!normalizedPath.startsWith(normalizedDir)) {
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
