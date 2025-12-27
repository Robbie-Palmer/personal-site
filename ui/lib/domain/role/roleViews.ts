import type { JobRole } from "./JobRole";
import type { TechnologyBadgeView } from "../technology/technologyViews";

/**
 * View types for JobRole
 * These are the ONLY types that UI components should use
 */

/**
 * Card view - for experience/role listings
 * Use for: experience cards, timeline entries
 */
export type RoleCardView = {
  slug: string;
  company: string;
  companyUrl: string;
  logoPath: string;
  title: string;
  location: string;
  startDate: string;
  endDate?: string;
  description: string;
  responsibilities: string[];
  technologies: TechnologyBadgeView[];
};

/**
 * List item view - minimal info for simple lists
 * Use for: navigation, role summaries
 */
export type RoleListItemView = {
  slug: string;
  company: string;
  title: string;
  startDate: string;
  endDate?: string;
};

/**
 * Transformers - pure functions to convert domain models to views
 */

export function toRoleCardView(
  role: JobRole,
  technologies: TechnologyBadgeView[],
): RoleCardView {
  return {
    slug: role.slug,
    company: role.company,
    companyUrl: role.companyUrl,
    logoPath: role.logoPath,
    title: role.title,
    location: role.location,
    startDate: role.startDate,
    endDate: role.endDate,
    description: role.description,
    responsibilities: role.responsibilities,
    technologies,
  };
}

export function toRoleListItemView(role: JobRole): RoleListItemView {
  return {
    slug: role.slug,
    company: role.company,
    title: role.title,
    startDate: role.startDate,
    endDate: role.endDate,
  };
}
