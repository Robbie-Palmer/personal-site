import {
  type DomainRepository,
  getContentForTag,
  getContentUsingTechnologyByType,
  getNodeSlug,
  getTagsForContent,
  getTechnologiesForBlog,
  isNodeType,
  makeNodeId,
} from "@/lib/repository";
import type { TechnologySlug } from "../technology/technology";
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
  const blogSlugs = Array.from(repository.blogs.keys()) as BlogSlug[];
  return mapBlogsToBlogCardViews(repository, blogSlugs);
}

export function getAllBlogListItems(
  repository: DomainRepository,
): BlogListItemView[] {
  return Array.from(repository.blogs.values()).map(toBlogListItemView);
}

function mapBlogsToBlogCardViews(
  repository: DomainRepository,
  blogSlugs: BlogSlug[],
): BlogCardView[] {
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

export function getBlogsUsingTechnology(
  repository: DomainRepository,
  technologySlug: TechnologySlug,
): BlogCardView[] {
  const { blogs: blogSlugs } = getContentUsingTechnologyByType(
    repository.graph,
    technologySlug,
  );

  return mapBlogsToBlogCardViews(repository, blogSlugs);
}

export function getBlogsByTag(
  repository: DomainRepository,
  tag: string,
): BlogCardView[] {
  const nodeIds = getContentForTag(repository.graph, tag);

  const blogSlugs = Array.from(nodeIds)
    .filter((nodeId) => isNodeType(nodeId, "blog"))
    .map((nodeId) => getNodeSlug(nodeId) as BlogSlug);

  return mapBlogsToBlogCardViews(repository, blogSlugs);
}
