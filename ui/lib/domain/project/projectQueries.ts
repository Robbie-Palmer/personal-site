import type { DomainRepository } from "../repository";
import { toTechnologyBadgeView } from "../technology/technologyViews";
import type { ProjectSlug } from "./Project";
import {
  type ProjectCardView,
  type ProjectDetailView,
  type ProjectListItemView,
  toProjectCardView,
  toProjectDetailView,
  toProjectListItemView,
} from "./projectViews";

/**
 * Query functions - the ONLY gateway for UI code to access project data
 * These functions return views, never domain models
 */

/**
 * Get a single project as a card view
 */
export function getProjectCard(
  repository: DomainRepository,
  slug: ProjectSlug,
): ProjectCardView | null {
  const project = repository.projects.get(slug);
  if (!project) return null;

  const technologies = project.relations.technologies
    .map((techSlug) => repository.technologies.get(techSlug))
    .filter((tech): tech is NonNullable<typeof tech> => tech !== undefined)
    .map(toTechnologyBadgeView);

  return toProjectCardView(project, technologies);
}

/**
 * Get a single project as a detail view
 */
export function getProjectDetail(
  repository: DomainRepository,
  slug: ProjectSlug,
): ProjectDetailView | null {
  const project = repository.projects.get(slug);
  if (!project) return null;

  const technologies = project.relations.technologies
    .map((techSlug) => repository.technologies.get(techSlug))
    .filter((tech): tech is NonNullable<typeof tech> => tech !== undefined)
    .map(toTechnologyBadgeView);

  return toProjectDetailView(project, technologies);
}

/**
 * Get a single project as a list item view
 */
export function getProjectListItem(
  repository: DomainRepository,
  slug: ProjectSlug,
): ProjectListItemView | null {
  const project = repository.projects.get(slug);
  if (!project) return null;
  return toProjectListItemView(project);
}

/**
 * Get all projects as card views
 */
export function getAllProjectCards(
  repository: DomainRepository,
): ProjectCardView[] {
  return Array.from(repository.projects.values()).map((project) => {
    const technologies = project.relations.technologies
      .map((techSlug) => repository.technologies.get(techSlug))
      .filter((tech): tech is NonNullable<typeof tech> => tech !== undefined)
      .map(toTechnologyBadgeView);

    return toProjectCardView(project, technologies);
  });
}

/**
 * Get all projects as list item views
 */
export function getAllProjectListItems(
  repository: DomainRepository,
): ProjectListItemView[] {
  return Array.from(repository.projects.values()).map(toProjectListItemView);
}

/**
 * Get projects that use a specific technology
 */
export function getProjectsUsingTechnology(
  repository: DomainRepository,
  technologySlug: string,
): ProjectCardView[] {
  return Array.from(repository.projects.values())
    .filter((project) =>
      project.relations.technologies.includes(technologySlug),
    )
    .map((project) => {
      const technologies = project.relations.technologies
        .map((techSlug) => repository.technologies.get(techSlug))
        .filter((tech): tech is NonNullable<typeof tech> => tech !== undefined)
        .map(toTechnologyBadgeView);

      return toProjectCardView(project, technologies);
    });
}
