import type { BlogPost } from "@/lib/domain/models";
import { loadDomainRepository } from "@/lib/domain/repository";

const repository = loadDomainRepository();

// Re-export the domain BlogPost type for backward compatibility
export type { BlogPost };

export function getAllPostSlugs(): string[] {
  return Array.from(repository.blogs.keys());
}

export function getPostBySlug(slug: string): BlogPost {
  const post = repository.blogs.get(slug);
  if (!post) {
    throw new Error(`Blog post not found: ${slug}`);
  }
  return post;
}

export function getAllPosts(): BlogPost[] {
  return Array.from(repository.blogs.values()).sort((a, b) => {
    // Parse dates and sort descending (newest first)
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
}
