import {
  type DomainRepository,
  getContentForTag,
  getContentUsingTechnologyByType,
  getTagsForContent,
  getTechnologiesForBlog,
  makeNodeId,
} from "@/lib/repository";
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

  const techSlugs = getTechnologiesForBlog(repository.graph, slug);
  const technologies = resolveTechnologiesToBadgeViews(repository, [
    ...techSlugs,
  ]);
  const tags = getTagsForContent(repository.graph, makeNodeId("blog", slug));

  return toBlogCardView(blog, technologies, [...tags]);
}

export function getBlogDetail(
  repository: DomainRepository,
  slug: BlogSlug,
): BlogDetailView | null {
  const blog = repository.blogs.get(slug);
  if (!blog) return null;

  const techSlugs = getTechnologiesForBlog(repository.graph, slug);
  const technologies = resolveTechnologiesToBadgeViews(repository, [
    ...techSlugs,
  ]);
  const tags = getTagsForContent(repository.graph, makeNodeId("blog", slug));

  return toBlogDetailView(blog, technologies, [...tags]);
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
    const techSlugs = getTechnologiesForBlog(repository.graph, blog.slug);
    const technologies = resolveTechnologiesToBadgeViews(repository, [
      ...techSlugs,
    ]);
    const tags = getTagsForContent(
      repository.graph,
      makeNodeId("blog", blog.slug),
    );

    return toBlogCardView(blog, technologies, [...tags]);
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
  const { blogs: blogSlugs } = getContentUsingTechnologyByType(
    repository.graph,
    technologySlug,
  );

  return blogSlugs
    .map((slug) => repository.blogs.get(slug))
    .filter((blog): blog is NonNullable<typeof blog> => blog !== undefined)
    .map((blog) => {
      const techSlugs = getTechnologiesForBlog(repository.graph, blog.slug);
      const technologies = resolveTechnologiesToBadgeViews(repository, [
        ...techSlugs,
      ]);
      const tags = getTagsForContent(
        repository.graph,
        makeNodeId("blog", blog.slug),
      );
      return toBlogCardView(blog, technologies, [...tags]);
    });
}

export function getBlogsByTag(
  repository: DomainRepository,
  tag: string,
): BlogCardView[] {
  const nodeIds = getContentForTag(repository.graph, tag);

  return Array.from(nodeIds)
    .filter((nodeId) => nodeId.startsWith("blog:"))
    .map((nodeId) => nodeId.slice(5) as BlogSlug)
    .map((slug) => repository.blogs.get(slug))
    .filter((blog): blog is NonNullable<typeof blog> => blog !== undefined)
    .map((blog) => {
      const techSlugs = getTechnologiesForBlog(repository.graph, blog.slug);
      const technologies = resolveTechnologiesToBadgeViews(repository, [
        ...techSlugs,
      ]);
      const tags = getTagsForContent(
        repository.graph,
        makeNodeId("blog", blog.slug),
      );

      return toBlogCardView(blog, technologies, [...tags]);
    });
}
