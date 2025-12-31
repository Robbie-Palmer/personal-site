import {
  getTechnologiesForADR,
  getTechnologiesForBlog,
  getTechnologiesForProject,
  getTechnologiesForRole,
} from "../graph/queries";
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
  return toTechnologyDetailView(tech, repository);
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
