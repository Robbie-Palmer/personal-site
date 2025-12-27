import type { TechnologyBadgeView } from "../technology/technologyViews";
import type { BlogPost } from "./BlogPost";

/**
 * View types for BlogPost
 * These are the ONLY types that UI components should use
 */

/**
 * Card view - for blog listings and grids
 * Use for: blog cards, blog lists, search results
 */
export type BlogCardView = {
  slug: string;
  title: string;
  description: string;
  date: string;
  updated?: string;
  tags: string[];
  image: string;
  imageAlt: string;
  readingTime: string;
  technologies: TechnologyBadgeView[];
};

/**
 * Detail view - full blog post information
 * Use for: blog post pages
 */
export type BlogDetailView = {
  slug: string;
  title: string;
  description: string;
  date: string;
  updated?: string;
  tags: string[];
  canonicalUrl?: string;
  content: string;
  readingTime: string;
  image: string;
  imageAlt: string;
  technologies: TechnologyBadgeView[];
};

/**
 * List item view - minimal info for simple lists
 * Use for: navigation, related posts, recent posts
 */
export type BlogListItemView = {
  slug: string;
  title: string;
  date: string;
  readingTime: string;
};

/**
 * Transformers - pure functions to convert domain models to views
 */

export function toBlogCardView(
  blog: BlogPost,
  technologies: TechnologyBadgeView[],
): BlogCardView {
  return {
    slug: blog.slug,
    title: blog.title,
    description: blog.description,
    date: blog.date,
    updated: blog.updated,
    tags: blog.tags,
    image: blog.image,
    imageAlt: blog.imageAlt,
    readingTime: blog.readingTime,
    technologies,
  };
}

export function toBlogDetailView(
  blog: BlogPost,
  technologies: TechnologyBadgeView[],
): BlogDetailView {
  return {
    slug: blog.slug,
    title: blog.title,
    description: blog.description,
    date: blog.date,
    updated: blog.updated,
    tags: blog.tags,
    canonicalUrl: blog.canonicalUrl,
    content: blog.content,
    readingTime: blog.readingTime,
    image: blog.image,
    imageAlt: blog.imageAlt,
    technologies,
  };
}

export function toBlogListItemView(blog: BlogPost): BlogListItemView {
  return {
    slug: blog.slug,
    title: blog.title,
    date: blog.date,
    readingTime: blog.readingTime,
  };
}
