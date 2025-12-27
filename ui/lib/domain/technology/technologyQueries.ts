import type { DomainRepository } from "../repository";
import type { TechnologySlug } from "./Technology";
import {
  toTechnologyBadgeView,
  toTechnologyDetailView,
  toTechnologyLabelView,
  toTechnologyLinkView,
  type TechnologyBadgeView,
  type TechnologyDetailView,
  type TechnologyLabelView,
  type TechnologyLinkView,
} from "./technologyViews";

/**
 * Query functions - the ONLY gateway for UI code to access technology data
 * These functions return views, never domain models
 */

/**
 * Get a single technology as a label view
 */
export function getTechnologyLabel(
  repository: DomainRepository,
  slug: TechnologySlug,
): TechnologyLabelView | null {
  const tech = repository.technologies.get(slug);
  if (!tech) return null;
  return toTechnologyLabelView(tech);
}

/**
 * Get a single technology as a badge view
 */
export function getTechnologyBadge(
  repository: DomainRepository,
  slug: TechnologySlug,
): TechnologyBadgeView | null {
  const tech = repository.technologies.get(slug);
  if (!tech) return null;
  return toTechnologyBadgeView(tech);
}

/**
 * Get a single technology as a link view
 */
export function getTechnologyLink(
  repository: DomainRepository,
  slug: TechnologySlug,
): TechnologyLinkView | null {
  const tech = repository.technologies.get(slug);
  if (!tech) return null;
  return toTechnologyLinkView(tech);
}

/**
 * Get a single technology as a detail view
 */
export function getTechnologyDetail(
  repository: DomainRepository,
  slug: TechnologySlug,
): TechnologyDetailView | null {
  const tech = repository.technologies.get(slug);
  if (!tech) return null;
  return toTechnologyDetailView(tech);
}

/**
 * Get all technologies as badge views
 */
export function getAllTechnologyBadges(
  repository: DomainRepository,
): TechnologyBadgeView[] {
  return Array.from(repository.technologies.values()).map(toTechnologyBadgeView);
}

/**
 * Get all technologies as label views
 */
export function getAllTechnologyLabels(
  repository: DomainRepository,
): TechnologyLabelView[] {
  return Array.from(repository.technologies.values()).map(toTechnologyLabelView);
}

/**
 * Get technology badges for a specific project
 */
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

/**
 * Get technology badges for a specific blog post
 */
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

/**
 * Get technology badges for a specific job role
 */
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

/**
 * Get technology labels for a specific ADR
 */
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
