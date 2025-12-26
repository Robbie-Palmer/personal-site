import type {
  ADR,
  ADRStatus,
  Project,
  ProjectStatus,
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

// Re-export types from domain models
export type { Project, ProjectStatus, ADR, ADRStatus };

// Re-export constants for backward compatibility
export const PROJECT_STATUSES = [
  "idea",
  "in_progress",
  "live",
  "archived",
] as const;

/**
 * Extended Project type with ADRs populated
 */
export interface ProjectWithADRs extends Project {
  adrs: ADR[];
}

/**
 * ADR with project context
 */
export interface ProjectADR extends ADR {
  projectSlug: string;
  projectTitle: string;
}

/**
 * Get all project slugs
 */
export function getAllProjectSlugs(): string[] {
  return Array.from(repository.projects.keys());
}

/**
 * Get a project by slug with all its ADRs populated
 */
export function getProject(slug: string): ProjectWithADRs {
  const domainProject = repository.projects.get(slug);
  if (!domainProject) {
    throw new Error(`Project not found: ${slug}`);
  }

  // Get ADRs for this project from the repository
  const projectAdrs = Array.from(repository.adrs.values())
    .filter((adr) => adr.relations.project === domainProject.slug)
    .sort((a, b) => a.slug.localeCompare(b.slug));

  return {
    ...domainProject,
    adrs: projectAdrs,
  };
}

/**
 * Get all projects with their ADRs, sorted by date (newest first)
 */
export function getAllProjects(): ProjectWithADRs[] {
  return Array.from(repository.projects.values())
    .map((project) => getProject(project.slug))
    .sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });
}

/**
 * Get all ADRs across all projects with project context
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
  return domainADR;
}
