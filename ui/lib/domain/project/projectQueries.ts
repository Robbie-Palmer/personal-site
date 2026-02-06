import {
  type DomainRepository,
  getADRCountForProject,
  getADRSlugsForProject,
  getContentUsingTechnologyByType,
  getProjectsForRole,
  getRoleForProject,
  getTagsForProject,
  getTechnologiesForProject,
} from "@/lib/repository";
import { getADRsForProject } from "../adr/adrQueries";
import type { RoleSlug } from "../role/jobRole";
import type { RoleListItemView } from "../role/roleViews";
import { toRoleListItemView } from "../role/roleViews";
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

function getRoleView(
  repository: DomainRepository,
  slug: ProjectSlug,
): RoleListItemView | undefined {
  const roleSlug = getRoleForProject(repository.graph, slug);
  const role = roleSlug ? repository.roles.get(roleSlug) : undefined;
  return role ? toRoleListItemView(role) : undefined;
}

export function getProjectCard(
  repository: DomainRepository,
  slug: ProjectSlug,
): ProjectCardView | null {
  const project = repository.projects.get(slug);
  if (!project) return null;

  const technologySlugs = getTechnologiesForProject(repository.graph, slug);
  const technologies = resolveTechnologiesToBadgeViews(repository, [
    ...technologySlugs,
  ]);
  const adrCount = getADRCountForProject(repository.graph, slug);
  const role = getRoleView(repository, slug);
  const tags = Array.from(getTagsForProject(repository.graph, slug));

  return toProjectCardView(project, technologies, adrCount, role, tags);
}

export function getProjectDetail(
  repository: DomainRepository,
  slug: ProjectSlug,
): ProjectDetailView | null {
  const project = repository.projects.get(slug);
  if (!project) return null;

  const technologySlugs = getTechnologiesForProject(repository.graph, slug);
  const technologies = resolveTechnologiesToBadgeViews(repository, [
    ...technologySlugs,
  ]);
  const adrSlugs = getADRSlugsForProject(repository.graph, slug);
  const role = getRoleView(repository, slug);
  const tags = Array.from(getTagsForProject(repository.graph, slug));

  return toProjectDetailView(project, technologies, adrSlugs, role, tags);
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
    const technologySlugs = getTechnologiesForProject(
      repository.graph,
      project.slug,
    );
    const technologies = resolveTechnologiesToBadgeViews(repository, [
      ...technologySlugs,
    ]);
    const adrCount = getADRCountForProject(repository.graph, project.slug);
    const role = getRoleView(repository, project.slug);
    const tags = Array.from(getTagsForProject(repository.graph, project.slug));

    return toProjectCardView(project, technologies, adrCount, role, tags);
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
  const { projects: projectSlugs } = getContentUsingTechnologyByType(
    repository.graph,
    technologySlug,
  );

  return projectSlugs
    .map((slug) => repository.projects.get(slug))
    .filter(
      (project): project is NonNullable<typeof project> =>
        project !== undefined,
    )
    .map((project) => {
      const techSlugs = getTechnologiesForProject(
        repository.graph,
        project.slug,
      );
      const technologies = resolveTechnologiesToBadgeViews(repository, [
        ...techSlugs,
      ]);
      const adrCount = getADRCountForProject(repository.graph, project.slug);
      const role = getRoleView(repository, project.slug);
      const tags = Array.from(
        getTagsForProject(repository.graph, project.slug),
      );

      return toProjectCardView(project, technologies, adrCount, role, tags);
    });
}

export function getBuildingPhilosophy(repository: DomainRepository): string {
  return repository.buildingPhilosophy;
}

export function getProjectWithADRs(
  repository: DomainRepository,
  slug: ProjectSlug,
): ProjectWithADRsView | null {
  const project = repository.projects.get(slug);
  if (!project) return null;

  const projectTechSlugs = getTechnologiesForProject(repository.graph, slug);
  const projectTechnologies = resolveTechnologiesToBadgeViews(repository, [
    ...projectTechSlugs,
  ]);

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

  const adrSlugs = getADRSlugsForProject(repository.graph, slug);
  const role = getRoleView(repository, slug);
  const tags = Array.from(getTagsForProject(repository.graph, slug));

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
    technologies: mergedTechnologies,
    adrSlugs,
    adrs,
    role,
    tags,
  };
}

export function getRoleProjects(
  repository: DomainRepository,
  roleSlug: RoleSlug,
): ProjectListItemView[] {
  const projectSlugs = getProjectsForRole(repository.graph, roleSlug);

  return Array.from(projectSlugs)
    .map((slug) => repository.projects.get(slug))
    .filter(
      (project): project is NonNullable<typeof project> =>
        project !== undefined,
    )
    .map(toProjectListItemView);
}
