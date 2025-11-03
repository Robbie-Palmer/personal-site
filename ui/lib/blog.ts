import {
  type BaseContent,
  ContentManager,
  type ContentValidator,
  validators,
} from "./content";

export interface BlogPost extends BaseContent {
  canonicalUrl?: string;
}

/**
 * Validator for blog post frontmatter
 */
const validateBlogPost: ContentValidator<BlogPost> = (data, _content, slug) => {
  return {
    title: validators.requireString(data, "title", slug),
    description: validators.requireString(data, "description", slug),
    date: validators.requireDate(data, "date", slug),
    updated: validators.optionalDate(data, "updated", slug),
    tags: validators.requireArray(data, "tags", slug),
    canonicalUrl: validators.optionalUrl(data, "canonicalUrl", slug),
  };
};

/**
 * Blog post content manager
 */
const blogManager = new ContentManager<BlogPost>({
  contentDir: "content/blog",
  validate: validateBlogPost,
});

/**
 * Get all blog post slugs
 */
export function getAllPostSlugs(): string[] {
  return blogManager.getAllSlugs();
}

/**
 * Get a single blog post by slug
 */
export function getPostBySlug(slug: string): BlogPost {
  return blogManager.getBySlug(slug);
}

/**
 * Get all blog posts, sorted by date (newest first)
 */
export function getAllPosts(): BlogPost[] {
  return blogManager.getAll();
}
