import type { TechnologyBadgeView } from "../technology/technologyViews";
import type { ADRCardView } from "../adr/adrViews";
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
  content: string;
  technologies: TechnologyBadgeView[];
  adrSlugs: string[];
  adrs: ADRCardView[];
};

export function toProjectCardView(
  project: Project,
  technologies: TechnologyBadgeView[],
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
    technologies,
    adrCount: project.relations.adrs.length,
  };
}

export function toProjectDetailView(
  project: Project,
  technologies: TechnologyBadgeView[],
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
    content: project.content,
    technologies,
    adrSlugs: project.relations.adrs,
  };
}

export function toProjectListItemView(project: Project): ProjectListItemView {
  return {
    slug: project.slug,
    title: project.title,
    status: project.status,
  };
}
