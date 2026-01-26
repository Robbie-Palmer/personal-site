import {
  type DomainRepository,
  getContentUsingTechnologyByType,
} from "@/lib/repository";
import { getTechSlug, hasTechIcon } from "../../api/tech-icons";
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
  website: string;
};

export type TechnologyLinkView = {
  slug: string;
  name: string;
  website: string;
};

export type TechnologyUsageView = {
  projects: string[];
  blogs: string[];
  adrs: string[];
  roles: string[];
};

export type TechnologyDetailView = {
  slug: string;
  name: string;
  description?: string;
  website: string;
  iconSlug?: string;
  hasIcon: boolean;
  usedIn: TechnologyUsageView;
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
  const iconSlug = tech.iconSlug || getTechSlug(tech.name);
  return {
    slug: tech.slug,
    name: tech.name,
    description: tech.description,
    website: tech.website,
    iconSlug,
    hasIcon: hasTechIcon(tech.name, iconSlug),
    usedIn: {
      projects: content.projects,
      blogs: content.blogs,
      adrs: content.adrs,
      roles: content.roles,
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
