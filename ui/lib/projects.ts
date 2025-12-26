import type {
  ADR as DomainADR,
  Project as DomainProject,
} from "@/lib/domain/models";
import {
  loadDomainRepository,
  validateReferentialIntegrity,
} from "@/lib/domain/repository";

// Load repository at module level - this runs during build/SSG
const repository = loadDomainRepository();

// Validate referential integrity - fail build if there are errors
const validationErrors = validateReferentialIntegrity(
  repository.technologies,
  repository.blogs,
  repository.projects,
  repository.adrs,
  repository.roles,
);

if (validationErrors.length > 0) {
  const errorMessages = validationErrors.map(
    (err) =>
      `[${err.type}] ${err.entity}.${err.field} ` +
      `references missing '${err.value}'`,
  );
  throw new Error(
    `Projects referential integrity validation failed:\n${errorMessages.join("\n")}`,
  );
}

// Re-export types and constants for backward compatibility
export const PROJECT_STATUSES = [
  "idea",
  "in_progress",
  "live",
  "archived",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/**
 * Backward-compatible Project type with snake_case fields
 * Maps from domain model (camelCase) to legacy format
 */
export interface Project {
  slug: string;
  title: string;
  description: string;
  tech_stack: string[];
  repo_url?: string;
  demo_url?: string;
  date: string;
  updated?: string;
  status: ProjectStatus;
  content: string;
  adrs: ADR[];
}

/**
 * Backward-compatible ADR type with snake_case fields
 */
export interface ADR {
  slug: string;
  title: string;
  date: string;
  status: "Accepted" | "Rejected" | "Deprecated" | "Proposed";
  superseded_by?: string;
  tech_stack?: string[];
  content: string;
  readingTime: string;
}

/**
 * ADR with project context
 */
export interface ProjectADR extends ADR {
  projectSlug: string;
  projectTitle: string;
}

/**
 * Adapters to convert domain models to backward-compatible format
 */

function adaptDomainADR(domainADR: DomainADR): ADR {
  return {
    slug: domainADR.slug,
    title: domainADR.title,
    date: domainADR.date,
    status: domainADR.status,
    superseded_by: domainADR.supersededBy,
    tech_stack:
      domainADR.relations.technologies.length > 0
        ? domainADR.relations.technologies
        : undefined,
    content: domainADR.content,
    readingTime: domainADR.readingTime,
  };
}

function adaptDomainProject(domainProject: DomainProject): Project {
  // Get ADRs for this project from the repository
  const projectAdrs = Array.from(repository.adrs.values())
    .filter((adr) => adr.relations.project === domainProject.slug)
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map(adaptDomainADR);

  // Merge technologies from project and accepted ADRs
  const adrTechStack = projectAdrs
    .filter((adr) => adr.status === "Accepted" && adr.tech_stack)
    .flatMap((adr) => adr.tech_stack || []);

  const mergedTechStack = Array.from(
    new Set([...domainProject.relations.technologies, ...adrTechStack]),
  ).sort();

  return {
    slug: domainProject.slug,
    title: domainProject.title,
    description: domainProject.description,
    tech_stack: mergedTechStack,
    repo_url: domainProject.repoUrl,
    demo_url: domainProject.demoUrl,
    date: domainProject.date,
    updated: domainProject.updated,
    status: domainProject.status,
    content: domainProject.content,
    adrs: projectAdrs,
  };
}

/**
 * Get all project slugs
 */
export function getAllProjectSlugs(): string[] {
  return Array.from(repository.projects.keys());
}

/**
 * Get a project by slug with all its ADRs
 */
export function getProject(slug: string): Project {
  const domainProject = repository.projects.get(slug);
  if (!domainProject) {
    throw new Error(`Project not found: ${slug}`);
  }
  return adaptDomainProject(domainProject);
}

/**
 * Get all projects, sorted by date (newest first)
 */
export function getAllProjects(): Project[] {
  return Array.from(repository.projects.values())
    .map(adaptDomainProject)
    .sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });
}

/**
 * Get all ADRs across all projects
 */
export function getAllADRs(): ProjectADR[] {
  const projects = getAllProjects();
  const allADRs = projects.flatMap((project) =>
    project.adrs.map((adr) => ({
      ...adr,
      projectSlug: project.slug,
      projectTitle: project.title,
    })),
  );

  return allADRs.sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateB - dateA;
  });
}

/**
 * Get a specific ADR from a project
 */
export function getProjectADR(projectSlug: string, adrSlug: string): ADR {
  const domainADR = repository.adrs.get(adrSlug);
  if (!domainADR) {
    throw new Error(`ADR not found: ${projectSlug}/${adrSlug}`);
  }
  if (domainADR.relations.project !== projectSlug) {
    throw new Error(`ADR ${adrSlug} does not belong to project ${projectSlug}`);
  }
  return adaptDomainADR(domainADR);
}
