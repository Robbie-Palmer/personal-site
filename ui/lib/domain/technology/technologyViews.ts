import type { Technology } from "./Technology";
import { hasTechIcon } from "../../tech-icons";

/**
 * View types for Technology
 * These are the ONLY types that UI components should use
 */

/**
 * Minimal view - just slug and name
 * Use for: simple lists, tags, breadcrumbs
 */
export type TechnologyLabelView = {
  slug: string;
  name: string;
};

/**
 * Badge view - for rendering visual badges with icons
 * Use for: project cards, tech stacks, experience cards
 */
export type TechnologyBadgeView = {
  slug: string;
  name: string;
  iconSlug: string;
  hasIcon: boolean;
  brandColor?: string;
};

/**
 * Link view - includes website URL for linking
 * Use for: clickable technology references
 */
export type TechnologyLinkView = {
  slug: string;
  name: string;
  website?: string;
};

/**
 * Detail view - full information for technology pages
 * Use for: technology detail pages, filters
 */
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

/**
 * Transformers - pure functions to convert domain models to views
 */

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

export function toTechnologyDetailView(
  tech: Technology,
): TechnologyDetailView {
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
