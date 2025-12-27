import {
  loadDomainRepository,
  type ProjectDetailView,
  getProjectDetail,
  type ADRCardView,
  getAllADRCards,
  getADRDetail,
  getADRsForProject,
  type ProjectStatus,
  type ADRStatus,
} from "@/lib/domain";

const repository = loadDomainRepository();

// Re-export types
export type { ProjectStatus, ADRStatus };

// Re-export view types for backward compatibility
export type Project = ProjectDetailView;
export type ADR = ADRCardView;

// Re-export constants for backward compatibility
export const PROJECT_STATUSES = [
  "idea",
  "in_progress",
  "live",
  "archived",
] as const;

/**
 * Extended project view with ADRs included
 */
export interface ProjectWithADRs extends ProjectDetailView {
  adrs: ADRCardView[];
}

/**
 * ADR view with project context
 */
export interface ProjectADR extends ADRCardView {
  projectSlug: string;
  projectTitle: string;
}

export function getAllProjectSlugs(): string[] {
  return Array.from(repository.projects.keys());
}

export function getProject(slug: string): ProjectWithADRs {
  const projectView = getProjectDetail(repository, slug);
  if (!projectView) {
    throw new Error(`Project not found: ${slug}`);
  }

  // Get ADRs for this project using the query function
  const projectAdrs = getADRsForProject(repository, slug);

  // Merge technologies from accepted ADRs into project technologies
  const adrTechnologies = projectAdrs
    .filter((adr) => adr.status === "Accepted")
    .flatMap((adr) => adr.technologies);

  const mergedTechnologies = [
    ...projectView.technologies,
    ...adrTechnologies.filter(
      (adrTech) =>
        !projectView.technologies.some((t) => t.slug === adrTech.slug),
    ),
  ];

  return {
    ...projectView,
    technologies: mergedTechnologies,
    adrs: projectAdrs,
  };
}

export function getAllProjects(): ProjectWithADRs[] {
  return Array.from(repository.projects.keys())
    .map((slug) => getProject(slug))
    .sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });
}

export function getAllADRs(): ProjectADR[] {
  const allADRCards = getAllADRCards(repository);
  const allADRs = allADRCards.map((adr) => {
    const project = repository.projects.get(adr.projectSlug);
    return {
      ...adr,
      projectSlug: adr.projectSlug,
      projectTitle: project?.title || "",
    };
  });
  return allADRs.sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateB - dateA;
  });
}

export function getProjectADR(projectSlug: string, adrSlug: string) {
  const adrView = getADRDetail(repository, adrSlug);
  if (!adrView) {
    throw new Error(`ADR not found: ${projectSlug}/${adrSlug}`);
  }
  if (adrView.projectSlug !== projectSlug) {
    throw new Error(`ADR ${adrSlug} does not belong to project ${projectSlug}`);
  }
  return adrView;
}
