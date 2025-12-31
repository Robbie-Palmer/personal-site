import {
  type DomainRepository,
  getContentUsingTechnologyByType,
  getTechnologiesForRole,
} from "@/lib/repository";
import { resolveTechnologiesToBadgeViews } from "../technology/technologyViews";
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

  const techSlugs = getTechnologiesForRole(repository.graph, slug);
  const technologies = resolveTechnologiesToBadgeViews(repository, [
    ...techSlugs,
  ]);

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
    const techSlugs = getTechnologiesForRole(repository.graph, role.slug);
    const technologies = resolveTechnologiesToBadgeViews(repository, [
      ...techSlugs,
    ]);

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
  const { roles: roleSlugs } = getContentUsingTechnologyByType(
    repository.graph,
    technologySlug,
  );

  return roleSlugs
    .map((slug) => repository.roles.get(slug))
    .filter((role): role is NonNullable<typeof role> => role !== undefined)
    .map((role) => {
      const techSlugs = getTechnologiesForRole(repository.graph, role.slug);
      const technologies = resolveTechnologiesToBadgeViews(repository, [
        ...techSlugs,
      ]);
      return toRoleCardView(role, technologies);
    });
}
