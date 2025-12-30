import type { ADRSlug } from "../adr/adr";
import type { BlogSlug } from "../blog/blogPost";
import type { ProjectSlug } from "../project/project";
import type { RoleSlug } from "../role/jobRole";
import type { TechnologySlug } from "../technology/technology";
import {
  type ContentGraph,
  getNodeSlug,
  isNodeType,
  makeNodeId,
  type NodeId,
  type NodeType,
} from "./types";

export function getTechnologiesForProject(
  graph: ContentGraph,
  slug: ProjectSlug,
): Set<TechnologySlug> {
  return (
    graph.edges.usesTechnology.get(makeNodeId("project", slug)) ?? new Set()
  );
}

export function getTechnologiesForADR(
  graph: ContentGraph,
  slug: ADRSlug,
): Set<TechnologySlug> {
  return graph.edges.usesTechnology.get(makeNodeId("adr", slug)) ?? new Set();
}

export function getTechnologiesForBlog(
  graph: ContentGraph,
  slug: BlogSlug,
): Set<TechnologySlug> {
  return graph.edges.usesTechnology.get(makeNodeId("blog", slug)) ?? new Set();
}

export function getTechnologiesForRole(
  graph: ContentGraph,
  slug: RoleSlug,
): Set<TechnologySlug> {
  return graph.edges.usesTechnology.get(makeNodeId("role", slug)) ?? new Set();
}

export function getContentUsingTechnology(
  graph: ContentGraph,
  slug: TechnologySlug,
): Set<NodeId> {
  return graph.reverse.technologyUsedBy.get(slug) ?? new Set();
}

export function getContentUsingTechnologyByType(
  graph: ContentGraph,
  slug: TechnologySlug,
): {
  projects: ProjectSlug[];
  adrs: ADRSlug[];
  blogs: BlogSlug[];
  roles: RoleSlug[];
} {
  const nodeIds = graph.reverse.technologyUsedBy.get(slug) ?? new Set();

  const result = {
    projects: [] as ProjectSlug[],
    adrs: [] as ADRSlug[],
    blogs: [] as BlogSlug[],
    roles: [] as RoleSlug[],
  };

  for (const nodeId of nodeIds) {
    if (isNodeType(nodeId, "project"))
      result.projects.push(getNodeSlug(nodeId));
    else if (isNodeType(nodeId, "adr")) result.adrs.push(getNodeSlug(nodeId));
    else if (isNodeType(nodeId, "blog")) result.blogs.push(getNodeSlug(nodeId));
    else if (isNodeType(nodeId, "role")) result.roles.push(getNodeSlug(nodeId));
  }

  return result;
}

export function getADRsForProject(
  graph: ContentGraph,
  slug: ProjectSlug,
): Set<ADRSlug> {
  return graph.reverse.projectADRs.get(slug) ?? new Set();
}

export function getProjectForADR(
  graph: ContentGraph,
  slug: ADRSlug,
): ProjectSlug | undefined {
  return graph.edges.partOfProject.get(slug);
}

export function getSupersedingADR(
  graph: ContentGraph,
  slug: ADRSlug,
): ADRSlug | undefined {
  return graph.reverse.supersededBy.get(slug);
}

export function getSupersededADR(
  graph: ContentGraph,
  slug: ADRSlug,
): ADRSlug | undefined {
  return graph.edges.supersedes.get(slug);
}

export function filterNodesByType<T extends NodeType>(
  nodeIds: Set<NodeId>,
  type: T,
): string[] {
  const result: string[] = [];
  for (const nodeId of nodeIds) {
    if (isNodeType(nodeId, type)) {
      result.push(getNodeSlug(nodeId));
    }
  }
  return result;
}
