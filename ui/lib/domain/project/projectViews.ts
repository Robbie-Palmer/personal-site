import type { ADRCardView } from "../adr/adrViews";
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
};

export function toProjectCardView(
  project: Project,
  technologies: TechnologyBadgeView[],
  adrCount: number,
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
  };
}

export function toProjectDetailView(
  project: Project,
  technologies: TechnologyBadgeView[],
  adrSlugs: string[],
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
  };
}

export function toProjectListItemView(project: Project): ProjectListItemView {
  return {
    slug: project.slug,
    title: project.title,
    status: project.status,
  };
}
