import { getADRsForProject } from "../adr/adrQueries";
import type { DomainRepository } from "../repository";
import { resolveTechnologiesToBadgeViews } from "../technology/technologyViews";
import type { ProjectSlug } from "./project";
import {
  type ProjectCardView,
  type ProjectDetailView,
  type ProjectListItemView,
  type ProjectWithADRsView,
  toProjectCardView,
  toProjectDetailView,
  toProjectListItemView,
} from "./projectViews";

export function getProjectCard(
  repository: DomainRepository,
  slug: ProjectSlug,
): ProjectCardView | null {
  const project = repository.projects.get(slug);
  if (!project) return null;

  const technologies = resolveTechnologiesToBadgeViews(
    repository,
    project.relations.technologies,
  );

  return toProjectCardView(project, technologies);
}

export function getProjectDetail(
  repository: DomainRepository,
  slug: ProjectSlug,
): ProjectDetailView | null {
  const project = repository.projects.get(slug);
  if (!project) return null;

  const technologies = resolveTechnologiesToBadgeViews(
    repository,
    project.relations.technologies,
  );

  return toProjectDetailView(project, technologies);
}

export function getProjectListItem(
  repository: DomainRepository,
  slug: ProjectSlug,
): ProjectListItemView | null {
  const project = repository.projects.get(slug);
  if (!project) return null;
  return toProjectListItemView(project);
}

export function getAllProjectCards(
  repository: DomainRepository,
): ProjectCardView[] {
  return Array.from(repository.projects.values()).map((project) => {
    const technologies = resolveTechnologiesToBadgeViews(
      repository,
      project.relations.technologies,
    );

    return toProjectCardView(project, technologies);
  });
}

export function getAllProjectListItems(
  repository: DomainRepository,
): ProjectListItemView[] {
  return Array.from(repository.projects.values()).map(toProjectListItemView);
}

export function getProjectsUsingTechnology(
  repository: DomainRepository,
  technologySlug: string,
): ProjectCardView[] {
  return Array.from(repository.projects.values())
    .filter((project) =>
      project.relations.technologies.includes(technologySlug),
    )
    .map((project) => {
      const technologies = resolveTechnologiesToBadgeViews(
        repository,
        project.relations.technologies,
      );

      return toProjectCardView(project, technologies);
    });
}

export function getProjectWithADRs(
  repository: DomainRepository,
  slug: ProjectSlug,
): ProjectWithADRsView | null {
  const project = repository.projects.get(slug);
  if (!project) return null;

  const projectTechnologies = resolveTechnologiesToBadgeViews(
    repository,
    project.relations.technologies,
  );

  const adrs = getADRsForProject(repository, slug);

  const adrTechnologies = adrs
    .filter((adr) => adr.status === "Accepted")
    .flatMap((adr) => adr.technologies);

  const mergedTechnologies = [
    ...projectTechnologies,
    ...adrTechnologies.filter(
      (adrTech) => !projectTechnologies.some((t) => t.slug === adrTech.slug),
    ),
  ];

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
    technologies: mergedTechnologies,
    adrSlugs: project.relations.adrs,
    adrs,
  };
}
