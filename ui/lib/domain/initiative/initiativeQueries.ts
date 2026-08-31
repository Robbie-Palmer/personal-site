import {
  type DomainRepository,
  getInitiativesForProject,
  getProjectsForInitiative,
} from "@/lib/repository";
import type { Project } from "../project/project";
import type { ProjectSlug } from "../slugs";
import type { Initiative, InitiativeSlug } from "./initiative";

export function getInitiative(
  repository: DomainRepository,
  slug: InitiativeSlug,
): Initiative | null {
  return repository.initiatives.get(slug) ?? null;
}

export function getAllInitiatives(repository: DomainRepository): Initiative[] {
  return Array.from(repository.initiatives.values());
}

export function getInitiativeProjects(
  repository: DomainRepository,
  slug: InitiativeSlug,
): Project[] {
  return Array.from(getProjectsForInitiative(repository.graph, slug))
    .map((projectSlug) => repository.projects.get(projectSlug))
    .filter((project): project is Project => project !== undefined);
}

export function getProjectInitiatives(
  repository: DomainRepository,
  slug: ProjectSlug,
): Initiative[] {
  return Array.from(getInitiativesForProject(repository.graph, slug))
    .map((initiativeSlug) => repository.initiatives.get(initiativeSlug))
    .filter((initiative): initiative is Initiative => initiative !== undefined);
}
