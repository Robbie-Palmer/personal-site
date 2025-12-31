import {
  type DomainRepository,
  getContentUsingTechnologyByType,
  getProjectForADR,
  getTechnologiesForADR,
} from "@/lib/repository";
import {
  resolveTechnologiesToBadgeViews,
  resolveTechnologiesToLabelViews,
} from "../technology/technologyViews";
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

  const techSlugs = getTechnologiesForADR(repository.graph, slug);
  const technologies = resolveTechnologiesToBadgeViews(repository, [
    ...techSlugs,
  ]);
  const projectSlug = getProjectForADR(repository.graph, slug);
  if (!projectSlug) return null;

  return toADRCardView(adr, technologies, projectSlug);
}

export function getADRDetail(
  repository: DomainRepository,
  slug: ADRSlug,
): ADRDetailView | null {
  const adr = repository.adrs.get(slug);
  if (!adr) return null;

  const techSlugs = getTechnologiesForADR(repository.graph, slug);
  const technologies = resolveTechnologiesToLabelViews(repository, [
    ...techSlugs,
  ]);
  const projectSlug = getProjectForADR(repository.graph, slug);
  if (!projectSlug) return null;

  return toADRDetailView(adr, technologies, projectSlug);
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
  return Array.from(repository.adrs.values())
    .map((adr) => {
      const techSlugs = getTechnologiesForADR(repository.graph, adr.slug);
      const technologies = resolveTechnologiesToBadgeViews(repository, [
        ...techSlugs,
      ]);
      const projectSlug = getProjectForADR(repository.graph, adr.slug);
      if (!projectSlug) return null;

      return toADRCardView(adr, technologies, projectSlug);
    })
    .filter((view): view is ADRCardView => view !== null);
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
  const adrSlugs = repository.graph.reverse.projectADRs.get(projectSlug);
  if (!adrSlugs) return [];

  return Array.from(adrSlugs)
    .map((slug) => repository.adrs.get(slug))
    .filter((adr): adr is NonNullable<typeof adr> => adr !== undefined)
    .map((adr) => {
      const techSlugs = getTechnologiesForADR(repository.graph, adr.slug);
      const technologies = resolveTechnologiesToBadgeViews(repository, [
        ...techSlugs,
      ]);
      return toADRCardView(adr, technologies, projectSlug);
    });
}

export function getADRsUsingTechnology(
  repository: DomainRepository,
  technologySlug: string,
): ADRCardView[] {
  const { adrs: adrSlugs } = getContentUsingTechnologyByType(
    repository.graph,
    technologySlug,
  );

  return adrSlugs
    .map((slug) => repository.adrs.get(slug))
    .filter((adr): adr is NonNullable<typeof adr> => adr !== undefined)
    .map((adr) => {
      const techSlugs = getTechnologiesForADR(repository.graph, adr.slug);
      const technologies = resolveTechnologiesToBadgeViews(repository, [
        ...techSlugs,
      ]);
      const projectSlug = getProjectForADR(repository.graph, adr.slug);
      if (!projectSlug) return null;
      return toADRCardView(adr, technologies, projectSlug);
    })
    .filter((view): view is ADRCardView => view !== null);
}
