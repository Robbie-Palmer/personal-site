import {
  type DomainRepository,
  getBlogsForRole,
  getContentForTag,
  getContentUsingTechnologyByType,
  getNodeSlug,
  getRoleForBlog,
  getTagsForContent,
  getTechnologiesForBlog,
  isNodeType,
  makeNodeId,
} from "@/lib/repository";
import type { RoleSlug } from "../role/jobRole";
import type { TechnologySlug } from "../technology/technology";
import { resolveTechnologiesToBadgeViews } from "../technology/technologyViews";
import type { BlogSlug } from "./blogPost";
import {
  type BlogCardView,
  type BlogDetailView,
  type BlogListItemView,
  type BlogRoleView,
  toBlogCardView,
  toBlogDetailView,
  toBlogListItemView,
} from "./blogViews";

function resolveRoleView(
  repository: DomainRepository,
  blogSlug: BlogSlug,
): BlogRoleView | undefined {
  const roleSlug = getRoleForBlog(repository.graph, blogSlug);
  if (!roleSlug) return undefined;
  const role = repository.roles.get(roleSlug);
  if (!role) return undefined;
  return {
    slug: role.slug,
    company: role.company,
    logoPath: role.logoPath,
  };
}

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
  const role = resolveRoleView(repository, slug);

  return toBlogCardView(blog, technologies, [...tags], role);
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
  const role = resolveRoleView(repository, slug);

  return toBlogDetailView(blog, technologies, [...tags], role);
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
      const role = resolveRoleView(repository, blog.slug);
      return toBlogCardView(blog, technologies, [...tags], role);
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

export function getRoleBlogs(
  repository: DomainRepository,
  roleSlug: RoleSlug,
): BlogListItemView[] {
  const blogSlugs = getBlogsForRole(repository.graph, roleSlug);

  return Array.from(blogSlugs)
    .map((slug) => repository.blogs.get(slug))
    .filter((blog): blog is NonNullable<typeof blog> => blog !== undefined)
    .map(toBlogListItemView);
}
