import {
  type DomainRepository,
  getContentUsingTechnologyByType,
} from "@/lib/repository";
import { hasTechIcon } from "../../tech-icons";
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
  website?: string;
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
  const iconSlug = tech.iconSlug || tech.slug;
  return {
    slug: tech.slug,
    name: tech.name,
    iconSlug,
    hasIcon: hasTechIcon(tech.name, iconSlug),
    website: tech.website,
  };
}

export function toTechnologyLinkView(tech: Technology): TechnologyLinkView {
  return {
    slug: tech.slug,
    name: tech.name,
    website: tech.website,
  };
}

export function toTechnologyDetailView(
  tech: Technology,
  repository: DomainRepository,
): TechnologyDetailView {
  const content = getContentUsingTechnologyByType(repository.graph, tech.slug);
  const iconSlug = tech.iconSlug || tech.slug;
  return {
    slug: tech.slug,
    name: tech.name,
    description: tech.description,
    website: tech.website,
    iconSlug,
    hasIcon: hasTechIcon(tech.name, iconSlug),
    usedIn: {
      projectsCount: content.projects.length,
      blogsCount: content.blogs.length,
      adrsCount: content.adrs.length,
      rolesCount: content.roles.length,
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
