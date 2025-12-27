import type { DomainRepository } from "../repository";
import { resolveTechnologiesToBadgeViews } from "../technology/technologyViews";
import type { BlogSlug } from "./blogPost";
import {
  type BlogCardView,
  type BlogDetailView,
  type BlogListItemView,
  toBlogCardView,
  toBlogDetailView,
  toBlogListItemView,
} from "./blogViews";

export function getBlogCard(
  repository: DomainRepository,
  slug: BlogSlug,
): BlogCardView | null {
  const blog = repository.blogs.get(slug);
  if (!blog) return null;

  const technologies = resolveTechnologiesToBadgeViews(
    repository,
    blog.relations.technologies,
  );

  return toBlogCardView(blog, technologies);
}

export function getBlogDetail(
  repository: DomainRepository,
  slug: BlogSlug,
): BlogDetailView | null {
  const blog = repository.blogs.get(slug);
  if (!blog) return null;

  const technologies = resolveTechnologiesToBadgeViews(
    repository,
    blog.relations.technologies,
  );

  return toBlogDetailView(blog, technologies);
}

export function getBlogListItem(
  repository: DomainRepository,
  slug: BlogSlug,
): BlogListItemView | null {
  const blog = repository.blogs.get(slug);
  if (!blog) return null;
  return toBlogListItemView(blog);
}

export function getAllBlogCards(repository: DomainRepository): BlogCardView[] {
  return Array.from(repository.blogs.values()).map((blog) => {
    const technologies = resolveTechnologiesToBadgeViews(
      repository,
      blog.relations.technologies,
    );

    return toBlogCardView(blog, technologies);
  });
}

export function getAllBlogListItems(
  repository: DomainRepository,
): BlogListItemView[] {
  return Array.from(repository.blogs.values()).map(toBlogListItemView);
}

export function getBlogsUsingTechnology(
  repository: DomainRepository,
  technologySlug: string,
): BlogCardView[] {
  return Array.from(repository.blogs.values())
    .filter((blog) => blog.relations.technologies.includes(technologySlug))
    .map((blog) => {
      const technologies = resolveTechnologiesToBadgeViews(
        repository,
        blog.relations.technologies,
      );

      return toBlogCardView(blog, technologies);
    });
}

export function getBlogsByTag(
  repository: DomainRepository,
  tag: string,
): BlogCardView[] {
  return Array.from(repository.blogs.values())
    .filter((blog) => blog.tags.includes(tag))
    .map((blog) => {
      const technologies = resolveTechnologiesToBadgeViews(
        repository,
        blog.relations.technologies,
      );

      return toBlogCardView(blog, technologies);
    });
}
