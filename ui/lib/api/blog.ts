import {
  type BlogCardView,
  type BlogDetailView,
  getBlogDetail,
  loadDomainRepository,
} from "@/lib/domain";

const repository = loadDomainRepository();

// Re-export view types for backward compatibility
export type BlogPost = BlogDetailView;
export type { BlogCardView };

export function getAllPostSlugs(): string[] {
  return Array.from(repository.blogs.keys());
}

export function getPostBySlug(slug: string): BlogDetailView {
  const post = getBlogDetail(repository, slug);
  if (!post) {
    throw new Error(`Blog post not found: ${slug}`);
  }
  return post;
}

export function getAllPosts(): BlogDetailView[] {
  // Return detail views for backward compatibility
  return Array.from(repository.blogs.keys())
    .map((slug) => getBlogDetail(repository, slug))
    .filter((post): post is BlogDetailView => post !== null)
    .sort((a, b) => {
      // Parse dates and sort descending (newest first)
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
}
