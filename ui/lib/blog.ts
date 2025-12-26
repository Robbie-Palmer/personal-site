import type { BlogPost } from "@/lib/domain/models";
import {
  loadDomainRepository,
  validateReferentialIntegrity,
} from "@/lib/domain/repository";

const repository = loadDomainRepository();
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
