import type { DomainRepository } from "@/lib/repository";
import { getTechSlug, hasTechIcon } from "../../api/tech-icons";
import type { Technology, TechnologySlug, TechnologyType } from "./technology";

export type TechnologyLabelView = {
  slug: string;
  name: string;
};

export type TechnologyBadgeView = {
  slug: string;
  name: string;
  iconSlug: string;
  hasIcon: boolean;
  website: string;
  type?: TechnologyType;
};

export type TechnologyLinkView = {
  slug: string;
  name: string;
  website: string;
};

export type TechnologyDetailView = {
  slug: string;
  name: string;
  description?: string;
  website: string;
  iconSlug?: string;
  hasIcon: boolean;
};

export function toTechnologyLabelView(tech: Technology): TechnologyLabelView {
  return {
    slug: tech.slug,
    name: tech.name,
  };
}

export function toTechnologyBadgeView(tech: Technology): TechnologyBadgeView {
  const iconSlug = tech.iconSlug || getTechSlug(tech.name);
  return {
    slug: tech.slug,
    name: tech.name,
    iconSlug,
    hasIcon: hasTechIcon(tech.name, iconSlug),
    website: tech.website,
    type: tech.type,
  };
}

export function toTechnologyLinkView(tech: Technology): TechnologyLinkView {
  return {
    slug: tech.slug,
    name: tech.name,
    website: tech.website,
  };
}

export function toTechnologyDetailView(tech: Technology): TechnologyDetailView {
  const iconSlug = tech.iconSlug || getTechSlug(tech.name);
  return {
    slug: tech.slug,
    name: tech.name,
    description: tech.description,
    website: tech.website,
    iconSlug,
    hasIcon: hasTechIcon(tech.name, iconSlug),
  };
}

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
