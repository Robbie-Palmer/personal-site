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

const repository = loadDomainRepository();
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

export interface ProjectWithADRs extends Project {
  adrs: ADR[];
}

export interface ProjectADR extends ADR {
  projectSlug: string;
  projectTitle: string;
}

export function getAllProjectSlugs(): string[] {
  return Array.from(repository.projects.keys());
}

export function getProject(slug: string): ProjectWithADRs {
  const domainProject = repository.projects.get(slug);
  if (!domainProject) {
    throw new Error(`Project not found: ${slug}`);
  }
  const projectAdrs = domainProject.relations.adrs.map(
    (adrSlug) => repository.adrs.get(adrSlug)!,
  );
  // Merge technologies from accepted ADRs into project technologies
  const adrTechnologies = projectAdrs
    .filter((adr) => adr.status === "Accepted")
    .flatMap((adr) => adr.relations.technologies);
  const mergedTechnologies = Array.from(
    new Set([...domainProject.relations.technologies, ...adrTechnologies]),
  ).sort();
  return {
    ...domainProject,
    relations: {
      ...domainProject.relations,
      technologies: mergedTechnologies,
    },
    adrs: projectAdrs,
  };
}

export function getAllProjects(): ProjectWithADRs[] {
  return Array.from(repository.projects.values())
    .map((project) => getProject(project.slug))
    .sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });
}

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
