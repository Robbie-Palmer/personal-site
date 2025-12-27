import type { DomainRepository } from "../repository";
import { toTechnologyBadgeView } from "../technology/technologyViews";
import type { RoleSlug } from "./JobRole";
import {
  type RoleCardView,
  type RoleListItemView,
  toRoleCardView,
  toRoleListItemView,
} from "./roleViews";

/**
 * Query functions - the ONLY gateway for UI code to access role data
 * These functions return views, never domain models
 */

/**
 * Get a single role as a card view
 */
export function getRoleCard(
  repository: DomainRepository,
  slug: RoleSlug,
): RoleCardView | null {
  const role = repository.roles.get(slug);
  if (!role) return null;

  const technologies = role.relations.technologies
    .map((techSlug) => repository.technologies.get(techSlug))
    .filter((tech): tech is NonNullable<typeof tech> => tech !== undefined)
    .map(toTechnologyBadgeView);

  return toRoleCardView(role, technologies);
}

/**
 * Get a single role as a list item view
 */
export function getRoleListItem(
  repository: DomainRepository,
  slug: RoleSlug,
): RoleListItemView | null {
  const role = repository.roles.get(slug);
  if (!role) return null;
  return toRoleListItemView(role);
}

/**
 * Get all roles as card views
 */
export function getAllRoleCards(repository: DomainRepository): RoleCardView[] {
  return Array.from(repository.roles.values()).map((role) => {
    const technologies = role.relations.technologies
      .map((techSlug) => repository.technologies.get(techSlug))
      .filter((tech): tech is NonNullable<typeof tech> => tech !== undefined)
      .map(toTechnologyBadgeView);

    return toRoleCardView(role, technologies);
  });
}

/**
 * Get all roles as list item views
 */
export function getAllRoleListItems(
  repository: DomainRepository,
): RoleListItemView[] {
  return Array.from(repository.roles.values()).map(toRoleListItemView);
}

/**
 * Get roles that use a specific technology
 */
export function getRolesUsingTechnology(
  repository: DomainRepository,
  technologySlug: string,
): RoleCardView[] {
  return Array.from(repository.roles.values())
    .filter((role) => role.relations.technologies.includes(technologySlug))
    .map((role) => {
      const technologies = role.relations.technologies
        .map((techSlug) => repository.technologies.get(techSlug))
        .filter((tech): tech is NonNullable<typeof tech> => tech !== undefined)
        .map(toTechnologyBadgeView);

      return toRoleCardView(role, technologies);
    });
}
