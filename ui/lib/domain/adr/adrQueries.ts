import type { DomainRepository } from "../repository";
import {
  toTechnologyBadgeView,
  toTechnologyLabelView,
} from "../technology/technologyViews";
import type { ADRSlug } from "./ADR";
import {
  type ADRCardView,
  type ADRDetailView,
  type ADRListItemView,
  toADRCardView,
  toADRDetailView,
  toADRListItemView,
} from "./adrViews";

/**
 * Query functions - the ONLY gateway for UI code to access ADR data
 * These functions return views, never domain models
 */

/**
 * Get a single ADR as a card view
 */
export function getADRCard(
  repository: DomainRepository,
  slug: ADRSlug,
): ADRCardView | null {
  const adr = repository.adrs.get(slug);
  if (!adr) return null;

  const technologies = adr.relations.technologies
    .map((techSlug) => repository.technologies.get(techSlug))
    .filter((tech): tech is NonNullable<typeof tech> => tech !== undefined)
    .map(toTechnologyBadgeView);

  return toADRCardView(adr, technologies);
}

/**
 * Get a single ADR as a detail view
 */
export function getADRDetail(
  repository: DomainRepository,
  slug: ADRSlug,
): ADRDetailView | null {
  const adr = repository.adrs.get(slug);
  if (!adr) return null;

  const technologies = adr.relations.technologies
    .map((techSlug) => repository.technologies.get(techSlug))
    .filter((tech): tech is NonNullable<typeof tech> => tech !== undefined)
    .map(toTechnologyLabelView);

  return toADRDetailView(adr, technologies);
}

/**
 * Get a single ADR as a list item view
 */
export function getADRListItem(
  repository: DomainRepository,
  slug: ADRSlug,
): ADRListItemView | null {
  const adr = repository.adrs.get(slug);
  if (!adr) return null;
  return toADRListItemView(adr);
}

/**
 * Get all ADRs as card views
 */
export function getAllADRCards(repository: DomainRepository): ADRCardView[] {
  return Array.from(repository.adrs.values()).map((adr) => {
    const technologies = adr.relations.technologies
      .map((techSlug) => repository.technologies.get(techSlug))
      .filter((tech): tech is NonNullable<typeof tech> => tech !== undefined)
      .map(toTechnologyBadgeView);

    return toADRCardView(adr, technologies);
  });
}

/**
 * Get all ADRs as list item views
 */
export function getAllADRListItems(
  repository: DomainRepository,
): ADRListItemView[] {
  return Array.from(repository.adrs.values()).map(toADRListItemView);
}

/**
 * Get ADRs for a specific project
 */
export function getADRsForProject(
  repository: DomainRepository,
  projectSlug: string,
): ADRCardView[] {
  return Array.from(repository.adrs.values())
    .filter((adr) => adr.relations.project === projectSlug)
    .map((adr) => {
      const technologies = adr.relations.technologies
        .map((techSlug) => repository.technologies.get(techSlug))
        .filter((tech): tech is NonNullable<typeof tech> => tech !== undefined)
        .map(toTechnologyBadgeView);

      return toADRCardView(adr, technologies);
    });
}

/**
 * Get ADRs that use a specific technology
 */
export function getADRsUsingTechnology(
  repository: DomainRepository,
  technologySlug: string,
): ADRCardView[] {
  return Array.from(repository.adrs.values())
    .filter((adr) => adr.relations.technologies.includes(technologySlug))
    .map((adr) => {
      const technologies = adr.relations.technologies
        .map((techSlug) => repository.technologies.get(techSlug))
        .filter((tech): tech is NonNullable<typeof tech> => tech !== undefined)
        .map(toTechnologyBadgeView);

      return toADRCardView(adr, technologies);
    });
}
