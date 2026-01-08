import type { ADRCardView } from "../adr/adrViews";
import type { RoleListItemView } from "../role/roleViews";
import type { TechnologyBadgeView } from "../technology/technologyViews";
import type { Project, ProjectStatus } from "./project";

export type ProjectCardView = {
  slug: string;
  title: string;
  description: string;
  date: string;
  updated?: string;
  status: ProjectStatus;
  repoUrl?: string;
  demoUrl?: string;
  productUrl?: string;
  technologies: TechnologyBadgeView[];
  adrCount: number;
  role?: RoleListItemView;
};

export type ProjectDetailView = {
  slug: string;
  title: string;
  description: string;
  date: string;
  updated?: string;
  status: ProjectStatus;
  repoUrl?: string;
  demoUrl?: string;
  productUrl?: string;
  content: string;
  technologies: TechnologyBadgeView[];
  adrSlugs: string[];
  role?: RoleListItemView;
};

export type ProjectListItemView = {
  slug: string;
  title: string;
  status: ProjectStatus;
};

export type ProjectWithADRsView = {
  slug: string;
  title: string;
  description: string;
  date: string;
  updated?: string;
  status: ProjectStatus;
  repoUrl?: string;
  demoUrl?: string;
  productUrl?: string;
  content: string;
  technologies: TechnologyBadgeView[];
  adrSlugs: string[];
  adrs: ADRCardView[];
  role?: RoleListItemView;
};

export function toProjectCardView(
  project: Project,
  technologies: TechnologyBadgeView[],
  adrCount: number,
  role?: RoleListItemView,
): ProjectCardView {
  return {
    slug: project.slug,
    title: project.title,
    description: project.description,
    date: project.date,
    updated: project.updated,
    status: project.status,
    repoUrl: project.repoUrl,
    demoUrl: project.demoUrl,
    productUrl: project.productUrl,
    technologies,
    adrCount,
    role,
  };
}

export function toProjectDetailView(
  project: Project,
  technologies: TechnologyBadgeView[],
  adrSlugs: string[],
  role?: RoleListItemView,
): ProjectDetailView {
  return {
    slug: project.slug,
    title: project.title,
    description: project.description,
    date: project.date,
    updated: project.updated,
    status: project.status,
    repoUrl: project.repoUrl,
    demoUrl: project.demoUrl,
    productUrl: project.productUrl,
    content: project.content,
    technologies,
    adrSlugs,
    role,
  };
}

export function toProjectListItemView(project: Project): ProjectListItemView {
  return {
    slug: project.slug,
    title: project.title,
    status: project.status,
  };
}
