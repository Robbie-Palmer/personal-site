import { hasTechIcon } from "../../tech-icons";
import type { DomainRepository } from "../repository";
import type { Technology, TechnologySlug } from "./technology";

export type TechnologyLabelView = {
  slug: string;
  name: string;
};

export type TechnologyBadgeView = {
  slug: string;
  name: string;
  iconSlug: string;
  hasIcon: boolean;
  brandColor?: string;
};

export type TechnologyLinkView = {
  slug: string;
  name: string;
  website?: string;
};

export type TechnologyDetailView = {
  slug: string;
  name: string;
  description?: string;
  website?: string;
  brandColor?: string;
  iconSlug?: string;
  hasIcon: boolean;
  usedIn: {
    projectsCount: number;
    blogsCount: number;
    adrsCount: number;
    rolesCount: number;
  };
};

export function toTechnologyLabelView(tech: Technology): TechnologyLabelView {
  return {
    slug: tech.slug,
    name: tech.name,
  };
}

export function toTechnologyBadgeView(tech: Technology): TechnologyBadgeView {
  return {
    slug: tech.slug,
    name: tech.name,
    iconSlug: tech.iconSlug || tech.slug,
    hasIcon: hasTechIcon(tech.name),
    brandColor: tech.brandColor,
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
  return {
    slug: tech.slug,
    name: tech.name,
    description: tech.description,
    website: tech.website,
    brandColor: tech.brandColor,
    iconSlug: tech.iconSlug,
    hasIcon: hasTechIcon(tech.name),
    usedIn: {
      projectsCount: tech.relations.projects.length,
      blogsCount: tech.relations.blogs.length,
      adrsCount: tech.relations.adrs.length,
      rolesCount: tech.relations.roles.length,
    },
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
