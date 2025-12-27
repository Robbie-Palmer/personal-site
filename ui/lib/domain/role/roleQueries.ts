import type { DomainRepository } from "../repository";
import { resolveTechnologiesToBadgeViews } from "../technology/technologyHelpers";
import type { RoleSlug } from "./jobRole";
import {
  type RoleCardView,
  type RoleListItemView,
  toRoleCardView,
  toRoleListItemView,
} from "./roleViews";

export function getRoleCard(
  repository: DomainRepository,
  slug: RoleSlug,
): RoleCardView | null {
  const role = repository.roles.get(slug);
  if (!role) return null;

  const technologies = resolveTechnologiesToBadgeViews(
    repository,
    role.relations.technologies,
  );

  return toRoleCardView(role, technologies);
}

export function getRoleListItem(
  repository: DomainRepository,
  slug: RoleSlug,
): RoleListItemView | null {
  const role = repository.roles.get(slug);
  if (!role) return null;
  return toRoleListItemView(role);
}

export function getAllRoleCards(repository: DomainRepository): RoleCardView[] {
  return Array.from(repository.roles.values()).map((role) => {
    const technologies = resolveTechnologiesToBadgeViews(
      repository,
      role.relations.technologies,
    );

    return toRoleCardView(role, technologies);
  });
}

export function getAllRoleListItems(
  repository: DomainRepository,
): RoleListItemView[] {
  return Array.from(repository.roles.values()).map(toRoleListItemView);
}

export function getRolesUsingTechnology(
  repository: DomainRepository,
  technologySlug: string,
): RoleCardView[] {
  return Array.from(repository.roles.values())
    .filter((role) => role.relations.technologies.includes(technologySlug))
    .map((role) => {
      const technologies = resolveTechnologiesToBadgeViews(
        repository,
        role.relations.technologies,
      );

      return toRoleCardView(role, technologies);
    });
}
