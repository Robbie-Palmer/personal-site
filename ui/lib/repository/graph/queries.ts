import type { ADRRef } from "@/lib/domain/adr/adr";
import type { BlogSlug } from "@/lib/domain/blog/blogPost";
import type { ProjectSlug } from "@/lib/domain/project/project";
import type { RoleSlug } from "@/lib/domain/role/jobRole";
import type { TechnologySlug } from "@/lib/domain/technology/technology";
import {
  type ContentGraph,
  getNodeSlug,
  isNodeType,
  makeNodeId,
  type NodeId,
  type NodeType,
} from "./types";

function getTechnologiesFor(
  graph: ContentGraph,
  type: NodeType,
  slug: string,
): Set<TechnologySlug> {
  return graph.edges.usesTechnology.get(makeNodeId(type, slug)) ?? new Set();
}

export function getTechnologiesForProject(
  graph: ContentGraph,
  slug: ProjectSlug,
): Set<TechnologySlug> {
  return getTechnologiesFor(graph, "project", slug);
}

export function getTechnologiesForADR(
  graph: ContentGraph,
  adrRef: ADRRef,
): Set<TechnologySlug> {
  return getTechnologiesFor(graph, "adr", adrRef);
}

export function getTechnologiesForBlog(
  graph: ContentGraph,
  slug: BlogSlug,
): Set<TechnologySlug> {
  return getTechnologiesFor(graph, "blog", slug);
}

export function getTechnologiesForRole(
  graph: ContentGraph,
  slug: RoleSlug,
): Set<TechnologySlug> {
  return getTechnologiesFor(graph, "role", slug);
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
  adrs: ADRRef[];
  blogs: BlogSlug[];
  roles: RoleSlug[];
} {
  const nodeIds = graph.reverse.technologyUsedBy.get(slug) ?? new Set();

  const result = {
    projects: [] as ProjectSlug[],
    adrs: [] as ADRRef[],
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
): Set<ADRRef> {
  return graph.reverse.projectADRs.get(slug) ?? new Set();
}

export function getProjectForADR(
  graph: ContentGraph,
  adrRef: ADRRef,
): ProjectSlug | undefined {
  return graph.edges.partOfProject.get(adrRef);
}

export function getSupersedingADR(
  graph: ContentGraph,
  adrRef: ADRRef,
): ADRRef | undefined {
  return graph.reverse.supersededBy.get(adrRef);
}

export function getSupersededADR(
  graph: ContentGraph,
  adrRef: ADRRef,
): ADRRef | undefined {
  return graph.edges.supersedes.get(adrRef);
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

export function getADRCountForProject(
  graph: ContentGraph,
  slug: ProjectSlug,
): number {
  return graph.reverse.projectADRs.get(slug)?.size ?? 0;
}

export function getADRSlugsForProject(
  graph: ContentGraph,
  slug: ProjectSlug,
): ADRRef[] {
  return Array.from(graph.reverse.projectADRs.get(slug) ?? []);
}

export function getTagsForContent(
  graph: ContentGraph,
  nodeId: NodeId,
): Set<string> {
  return graph.edges.hasTag.get(nodeId) ?? new Set();
}

export function getTagsForProject(
  graph: ContentGraph,
  slug: ProjectSlug,
): Set<string> {
  return getTagsForContent(graph, makeNodeId("project", slug));
}

export function getContentForTag(
  graph: ContentGraph,
  tag: string,
): Set<NodeId> {
  return graph.reverse.tagUsedBy.get(tag) ?? new Set();
}

export function getAllTags(graph: ContentGraph): string[] {
  return Array.from(graph.reverse.tagUsedBy.keys());
}

export function getRoleForProject(
  graph: ContentGraph,
  slug: ProjectSlug,
): RoleSlug | undefined {
  return graph.edges.createdAtRole.get(slug);
}

export function getProjectsForRole(
  graph: ContentGraph,
  slug: RoleSlug,
): Set<ProjectSlug> {
  return graph.reverse.roleProjects.get(slug) ?? new Set();
}

export function getRoleForBlog(
  graph: ContentGraph,
  slug: BlogSlug,
): RoleSlug | undefined {
  return graph.edges.writtenAtRole.get(slug);
}

export function getBlogsForRole(
  graph: ContentGraph,
  slug: RoleSlug,
): Set<BlogSlug> {
  return graph.reverse.roleBlogs.get(slug) ?? new Set();
}
