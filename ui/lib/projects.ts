import {
  type ADRCardView,
  type ADRDetailView,
  type ADRStatus,
  getADRDetail,
  getAllADRCards,
  getProjectWithADRs,
  loadDomainRepository,
  type ProjectStatus,
  type ProjectWithADRsView,
} from "@/lib/domain";

const repository = loadDomainRepository();

export type { ProjectStatus, ADRStatus, ADRDetailView };

export type Project = ProjectWithADRsView;
export type ADR = ADRCardView;
export type ProjectWithADRs = ProjectWithADRsView;

export const PROJECT_STATUSES = [
  "idea",
  "in_progress",
  "live",
  "archived",
] as const;

export interface ProjectADR extends ADRCardView {
  projectSlug: string;
  projectTitle: string;
}

export function getAllProjectSlugs(): string[] {
  return Array.from(repository.projects.keys());
}

export function getProject(slug: string): ProjectWithADRs {
  const project = getProjectWithADRs(repository, slug);
  if (!project) {
    throw new Error(`Project not found: ${slug}`);
  }
  return project;
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
    const project = repository.projects.get(adr.projectSlug)!;
    return {
      ...adr,
      projectSlug: adr.projectSlug,
      projectTitle: project.title,
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
