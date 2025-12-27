import type { DomainRepository } from "../repository";
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
  return toTechnologyDetailView(tech);
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
  const project = repository.projects.get(projectSlug);
  if (!project) return [];

  return resolveTechnologiesToBadgeViews(
    repository,
    project.relations.technologies,
  );
}

export function getTechnologyBadgesForBlog(
  repository: DomainRepository,
  blogSlug: string,
): TechnologyBadgeView[] {
  const blog = repository.blogs.get(blogSlug);
  if (!blog) return [];

  return resolveTechnologiesToBadgeViews(
    repository,
    blog.relations.technologies,
  );
}

export function getTechnologyBadgesForRole(
  repository: DomainRepository,
  roleSlug: string,
): TechnologyBadgeView[] {
  const role = repository.roles.get(roleSlug);
  if (!role) return [];

  return resolveTechnologiesToBadgeViews(
    repository,
    role.relations.technologies,
  );
}

export function getTechnologyLabelsForADR(
  repository: DomainRepository,
  adrSlug: string,
): TechnologyLabelView[] {
  const adr = repository.adrs.get(adrSlug);
  if (!adr) return [];

  return resolveTechnologiesToLabelViews(
    repository,
    adr.relations.technologies,
  );
}
