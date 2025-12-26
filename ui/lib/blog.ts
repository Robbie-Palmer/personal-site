import type { BlogPost } from "@/lib/domain/models";
import {
  loadDomainRepository,
  validateReferentialIntegrity,
} from "@/lib/domain/repository";

// Load repository at module level - this runs during build/SSG
// and will fail the build if there are validation errors
const repository = loadDomainRepository();

// Validate referential integrity - fail build if there are errors
const validationErrors = validateReferentialIntegrity(
  repository.technologies,
  repository.blogs,
  repository.projects,
  repository.adrs,
  repository.roles,
);

if (validationErrors.length > 0) {
  const errorMessages = validationErrors.map(
    (err) =>
      `[${err.type}] ${err.entity}.${err.field} ` +
      `references missing '${err.value}'`,
  );
  throw new Error(
    `Blog referential integrity validation failed:\n${errorMessages.join("\n")}`,
  );
}

// Re-export the domain BlogPost type for backward compatibility
export type { BlogPost };

/**
 * Get all blog post slugs
 * @returns Array of blog post slugs
 */
export function getAllPostSlugs(): string[] {
  return Array.from(repository.blogs.keys());
}

/**
 * Get a blog post by slug
 * @param slug - The blog post slug
 * @returns The blog post
 * @throws Error if post not found
 */
export function getPostBySlug(slug: string): BlogPost {
  const post = repository.blogs.get(slug);
  if (!post) {
    throw new Error(`Blog post not found: ${slug}`);
  }
  return post;
}

/**
 * Get all blog posts, sorted by date (newest first)
 * @returns Array of blog posts sorted by date descending
 */
export function getAllPosts(): BlogPost[] {
  return Array.from(repository.blogs.values()).sort((a, b) => {
    // Parse dates and sort descending (newest first)
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
}
