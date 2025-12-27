import type { Project, ProjectStatus } from "./Project";
import type { TechnologyBadgeView } from "../technology/technologyViews";

/**
 * View types for Project
 * These are the ONLY types that UI components should use
 */

/**
 * Card view - for project listings and grids
 * Use for: project cards, project lists, search results
 */
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

/**
 * Detail view - full project information
 * Use for: project detail pages
 */
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

/**
 * List item view - minimal info for simple lists
 * Use for: navigation, related projects, breadcrumbs
 */
export type ProjectListItemView = {
  slug: string;
  title: string;
  status: ProjectStatus;
};

/**
 * Transformers - pure functions to convert domain models to views
 * Note: Technologies need to be resolved separately via query functions
 */

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
