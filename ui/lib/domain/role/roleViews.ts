import type { TechnologyBadgeView } from "../technology/technologyViews";
import type { JobRole } from "./jobRole";

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

export type RoleListItemView = {
  slug: string;
  company: string;
  title: string;
  startDate: string;
  endDate?: string;
};

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
