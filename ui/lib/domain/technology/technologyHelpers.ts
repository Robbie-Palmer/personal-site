import type { DomainRepository } from "../repository";
import type { TechnologySlug } from "./technology";
import { toTechnologyBadgeView, toTechnologyLabelView } from "./technologyViews";

export function resolveTechnologiesToBadgeViews(
  repository: DomainRepository,
  techSlugs: TechnologySlug[],
) {
  return techSlugs
    .map((slug) => repository.technologies.get(slug))
    .filter((tech): tech is NonNullable<typeof tech> => tech !== undefined)
    .map(toTechnologyBadgeView);
}

export function resolveTechnologiesToLabelViews(
  repository: DomainRepository,
  techSlugs: TechnologySlug[],
) {
  return techSlugs
    .map((slug) => repository.technologies.get(slug))
    .filter((tech): tech is NonNullable<typeof tech> => tech !== undefined)
    .map(toTechnologyLabelView);
}
