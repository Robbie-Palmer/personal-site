import {
  type DomainRepository,
  getContentUsingTechnologyByType,
  getTechnologiesForADR,
  getTechnologiesForBlog,
  getTechnologiesForProject,
  getTechnologiesForRole,
} from "@/lib/repository";
import { toADRListItemView, type ADRListItemView } from "../adr/adrViews";
import { toBlogListItemView, type BlogListItemView } from "../blog/blogViews";
import {
  toProjectListItemView,
  type ProjectListItemView,
} from "../project/projectViews";
import { toRoleListItemView, type RoleListItemView } from "../role/roleViews";
import type { TechnologySlug } from "./technology";
import {
  resolveTechnologiesToBadgeViews,
  resolveTechnologiesToLabelViews,
  type TechnologyBadgeView,
  type TechnologyDetailView,
  type TechnologyLabelView,
  type TechnologyLinkView,
  toTechnologyBadgeView,
  toTechnologyDetailView,
  toTechnologyLabelView,
  toTechnologyLinkView,
} from "./technologyViews";

export function getTechnologyLabel(
  repository: DomainRepository,
  slug: TechnologySlug,
): TechnologyLabelView | null {
  const tech = repository.technologies.get(slug);
  if (!tech) return null;
  return toTechnologyLabelView(tech);
}

export function getTechnologyBadge(
  repository: DomainRepository,
  slug: TechnologySlug,
): TechnologyBadgeView | null {
  const tech = repository.technologies.get(slug);
  if (!tech) return null;
  return toTechnologyBadgeView(tech);
}

export function getTechnologyLink(
  repository: DomainRepository,
  slug: TechnologySlug,
): TechnologyLinkView | null {
  const tech = repository.technologies.get(slug);
  if (!tech) return null;
  return toTechnologyLinkView(tech);
}

export function getTechnologyDetail(
  repository: DomainRepository,
  slug: TechnologySlug,
): TechnologyDetailView | null {
  const tech = repository.technologies.get(slug);
  if (!tech) return null;
  return toTechnologyDetailView(tech, repository);
}

export function getAllTechnologySlugs(repository: DomainRepository): string[] {
  return Array.from(repository.technologies.keys());
}

export function getAllTechnologyBadges(
  repository: DomainRepository,
): TechnologyBadgeView[] {
  return Array.from(repository.technologies.values()).map(
    toTechnologyBadgeView,
  );
}

export function getAllTechnologyLabels(
  repository: DomainRepository,
): TechnologyLabelView[] {
  return Array.from(repository.technologies.values()).map(
    toTechnologyLabelView,
  );
}

export function getTechnologyBadgesForProject(
  repository: DomainRepository,
  projectSlug: string,
): TechnologyBadgeView[] {
  const techSlugs = getTechnologiesForProject(repository.graph, projectSlug);
  return resolveTechnologiesToBadgeViews(repository, [...techSlugs]);
}

export function getTechnologyBadgesForBlog(
  repository: DomainRepository,
  blogSlug: string,
): TechnologyBadgeView[] {
  const techSlugs = getTechnologiesForBlog(repository.graph, blogSlug);
  return resolveTechnologiesToBadgeViews(repository, [...techSlugs]);
}

export function getTechnologyBadgesForRole(
  repository: DomainRepository,
  roleSlug: string,
): TechnologyBadgeView[] {
  const techSlugs = getTechnologiesForRole(repository.graph, roleSlug);
  return resolveTechnologiesToBadgeViews(repository, [...techSlugs]);
}

export function getTechnologyLabelsForADR(
  repository: DomainRepository,
  adrSlug: string,
): TechnologyLabelView[] {
  const techSlugs = getTechnologiesForADR(repository.graph, adrSlug);
  return resolveTechnologiesToLabelViews(repository, [...techSlugs]);
}

/**
 * Get related content for a technology with rich views.
 * Returns list item views for projects, blogs, roles, and ADRs that use this technology.
 */
export type TechnologyRelatedContentView = {
  projects: ProjectListItemView[];
  blogs: BlogListItemView[];
  roles: RoleListItemView[];
  adrs: ADRListItemView[];
};

export function getRelatedContentForTechnology(
  repository: DomainRepository,
  slug: TechnologySlug,
): TechnologyRelatedContentView {
  const usage = getContentUsingTechnologyByType(repository.graph, slug);

  return {
    projects: usage.projects
      .map((projectSlug) => repository.projects.get(projectSlug))
      .filter((p): p is NonNullable<typeof p> => p !== undefined)
      .map(toProjectListItemView),
    blogs: usage.blogs
      .map((blogSlug) => repository.blogs.get(blogSlug))
      .filter((b): b is NonNullable<typeof b> => b !== undefined)
      .map(toBlogListItemView),
    roles: usage.roles
      .map((roleSlug) => repository.roles.get(roleSlug))
      .filter((r): r is NonNullable<typeof r> => r !== undefined)
      .map(toRoleListItemView),
    adrs: usage.adrs
      .map((adrSlug) => repository.adrs.get(adrSlug))
      .filter((a): a is NonNullable<typeof a> => a !== undefined)
      .map(toADRListItemView),
  };
}
