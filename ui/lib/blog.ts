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
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => file.replace(/\.mdx$/, ""));
}

export function getPostBySlug(slug: string): BlogPost {
  const fullPath = path.join(contentDirectory, `${slug}.mdx`);
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
    if (a.date > b.date) return -1;
    if (a.date < b.date) return 1;
    return 0;
  });
}
