import type { DomainRepository } from "../repository";
import {
  resolveTechnologiesToBadgeViews,
  resolveTechnologiesToLabelViews,
} from "../technology/technologyHelpers";
import type { ADRSlug } from "./adr";
import {
  type ADRCardView,
  type ADRDetailView,
  type ADRListItemView,
  toADRCardView,
  toADRDetailView,
  toADRListItemView,
} from "./adrViews";

export function getADRCard(
  repository: DomainRepository,
  slug: ADRSlug,
): ADRCardView | null {
  const adr = repository.adrs.get(slug);
  if (!adr) return null;

  const technologies = resolveTechnologiesToBadgeViews(
    repository,
    adr.relations.technologies,
  );

  return toADRCardView(adr, technologies);
}

export function getADRDetail(
  repository: DomainRepository,
  slug: ADRSlug,
): ADRDetailView | null {
  const adr = repository.adrs.get(slug);
  if (!adr) return null;

  const technologies = resolveTechnologiesToLabelViews(
    repository,
    adr.relations.technologies,
  );

  return toADRDetailView(adr, technologies);
}

export function getADRListItem(
  repository: DomainRepository,
  slug: ADRSlug,
): ADRListItemView | null {
  const adr = repository.adrs.get(slug);
  if (!adr) return null;
  return toADRListItemView(adr);
}

export function getAllADRCards(repository: DomainRepository): ADRCardView[] {
  return Array.from(repository.adrs.values()).map((adr) => {
    const technologies = resolveTechnologiesToBadgeViews(
      repository,
      adr.relations.technologies,
    );

    return toADRCardView(adr, technologies);
  });
}

export function getAllADRListItems(
  repository: DomainRepository,
): ADRListItemView[] {
  return Array.from(repository.adrs.values()).map(toADRListItemView);
}

export function getADRsForProject(
  repository: DomainRepository,
  projectSlug: string,
): ADRCardView[] {
  return Array.from(repository.adrs.values())
    .filter((adr) => adr.relations.project === projectSlug)
    .map((adr) => {
      const technologies = resolveTechnologiesToBadgeViews(
        repository,
        adr.relations.technologies,
      );

      return toADRCardView(adr, technologies);
    });
}

export function getADRsUsingTechnology(
  repository: DomainRepository,
  technologySlug: string,
): ADRCardView[] {
  return Array.from(repository.adrs.values())
    .filter((adr) => adr.relations.technologies.includes(technologySlug))
    .map((adr) => {
      const technologies = resolveTechnologiesToBadgeViews(
        repository,
        adr.relations.technologies,
      );

      return toADRCardView(adr, technologies);
    });
}
