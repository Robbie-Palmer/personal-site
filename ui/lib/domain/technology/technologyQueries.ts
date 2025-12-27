import type { DomainRepository } from "../repository";
import type { TechnologySlug } from "./technology";
import {
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

  return project.relations.technologies
    .map((techSlug) => repository.technologies.get(techSlug))
    .filter((tech): tech is NonNullable<typeof tech> => tech !== undefined)
    .map(toTechnologyBadgeView);
}

export function getTechnologyBadgesForBlog(
  repository: DomainRepository,
  blogSlug: string,
): TechnologyBadgeView[] {
  const blog = repository.blogs.get(blogSlug);
  if (!blog) return [];

  return blog.relations.technologies
    .map((techSlug) => repository.technologies.get(techSlug))
    .filter((tech): tech is NonNullable<typeof tech> => tech !== undefined)
    .map(toTechnologyBadgeView);
}

export function getTechnologyBadgesForRole(
  repository: DomainRepository,
  roleSlug: string,
): TechnologyBadgeView[] {
  const role = repository.roles.get(roleSlug);
  if (!role) return [];

  return role.relations.technologies
    .map((techSlug) => repository.technologies.get(techSlug))
    .filter((tech): tech is NonNullable<typeof tech> => tech !== undefined)
    .map(toTechnologyBadgeView);
}

export function getTechnologyLabelsForADR(
  repository: DomainRepository,
  adrSlug: string,
): TechnologyLabelView[] {
  const adr = repository.adrs.get(adrSlug);
  if (!adr) return [];

  return adr.relations.technologies
    .map((techSlug) => repository.technologies.get(techSlug))
    .filter((tech): tech is NonNullable<typeof tech> => tech !== undefined)
    .map(toTechnologyLabelView);
}
