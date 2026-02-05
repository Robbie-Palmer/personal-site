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
  tags: string[];
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
  tags: string[];
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
  tags: string[];
};

export function toProjectCardView(
  project: Project,
  technologies: TechnologyBadgeView[],
  adrCount: number,
  role: RoleListItemView | undefined,
  tags: string[],
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
    tags,
  };
}

export function toProjectDetailView(
  project: Project,
  technologies: TechnologyBadgeView[],
  adrSlugs: string[],
  role: RoleListItemView | undefined,
  tags: string[],
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
    tags,
  };
}

export function toProjectListItemView(project: Project): ProjectListItemView {
  return {
    slug: project.slug,
    title: project.title,
    status: project.status,
  };
}
