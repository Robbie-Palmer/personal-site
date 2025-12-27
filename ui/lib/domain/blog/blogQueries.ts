import type { DomainRepository } from "../repository";
import { toTechnologyBadgeView } from "../technology/technologyViews";
import type { BlogSlug } from "./BlogPost";
import {
  type BlogCardView,
  type BlogDetailView,
  type BlogListItemView,
  toBlogCardView,
  toBlogDetailView,
  toBlogListItemView,
} from "./blogViews";

/**
 * Query functions - the ONLY gateway for UI code to access blog data
 * These functions return views, never domain models
 */

/**
 * Get a single blog post as a card view
 */
export function getBlogCard(
  repository: DomainRepository,
  slug: BlogSlug,
): BlogCardView | null {
  const blog = repository.blogs.get(slug);
  if (!blog) return null;

  const technologies = blog.relations.technologies
    .map((techSlug) => repository.technologies.get(techSlug))
    .filter((tech): tech is NonNullable<typeof tech> => tech !== undefined)
    .map(toTechnologyBadgeView);

  return toBlogCardView(blog, technologies);
}

/**
 * Get a single blog post as a detail view
 */
export function getBlogDetail(
  repository: DomainRepository,
  slug: BlogSlug,
): BlogDetailView | null {
  const blog = repository.blogs.get(slug);
  if (!blog) return null;

  const technologies = blog.relations.technologies
    .map((techSlug) => repository.technologies.get(techSlug))
    .filter((tech): tech is NonNullable<typeof tech> => tech !== undefined)
    .map(toTechnologyBadgeView);

  return toBlogDetailView(blog, technologies);
}

/**
 * Get a single blog post as a list item view
 */
export function getBlogListItem(
  repository: DomainRepository,
  slug: BlogSlug,
): BlogListItemView | null {
  const blog = repository.blogs.get(slug);
  if (!blog) return null;
  return toBlogListItemView(blog);
}

/**
 * Get all blog posts as card views
 */
export function getAllBlogCards(repository: DomainRepository): BlogCardView[] {
  return Array.from(repository.blogs.values()).map((blog) => {
    const technologies = blog.relations.technologies
      .map((techSlug) => repository.technologies.get(techSlug))
      .filter((tech): tech is NonNullable<typeof tech> => tech !== undefined)
      .map(toTechnologyBadgeView);

    return toBlogCardView(blog, technologies);
  });
}

/**
 * Get all blog posts as list item views
 */
export function getAllBlogListItems(
  repository: DomainRepository,
): BlogListItemView[] {
  return Array.from(repository.blogs.values()).map(toBlogListItemView);
}

/**
 * Get blog posts that use a specific technology
 */
export function getBlogsUsingTechnology(
  repository: DomainRepository,
  technologySlug: string,
): BlogCardView[] {
  return Array.from(repository.blogs.values())
    .filter((blog) => blog.relations.technologies.includes(technologySlug))
    .map((blog) => {
      const technologies = blog.relations.technologies
        .map((techSlug) => repository.technologies.get(techSlug))
        .filter((tech): tech is NonNullable<typeof tech> => tech !== undefined)
        .map(toTechnologyBadgeView);

      return toBlogCardView(blog, technologies);
    });
}

/**
 * Get blog posts by tag
 */
export function getBlogsByTag(
  repository: DomainRepository,
  tag: string,
): BlogCardView[] {
  return Array.from(repository.blogs.values())
    .filter((blog) => blog.tags.includes(tag))
    .map((blog) => {
      const technologies = blog.relations.technologies
        .map((techSlug) => repository.technologies.get(techSlug))
        .filter((tech): tech is NonNullable<typeof tech> => tech !== undefined)
        .map(toTechnologyBadgeView);

      return toBlogCardView(blog, technologies);
    });
}
