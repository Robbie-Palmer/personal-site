import type { ADRRef } from "@/lib/domain/adr/adr";
import type { BlogSlug } from "@/lib/domain/blog/blogPost";
import type { ProjectSlug } from "@/lib/domain/project/project";
import type { RoleSlug } from "@/lib/domain/role/jobRole";
import type { TechnologySlug } from "@/lib/domain/technology/technology";
import { type ContentGraph, makeNodeId, type NodeId } from "./types";

export interface RelationData {
  projectTechnologies: Map<ProjectSlug, TechnologySlug[]>;
  projectADRs: Map<ProjectSlug, ADRRef[]>;
  projectRole: Map<ProjectSlug, RoleSlug>;
  projectTags: Map<ProjectSlug, string[]>;
  blogTechnologies: Map<BlogSlug, TechnologySlug[]>;
  blogTags: Map<BlogSlug, string[]>;
  adrTechnologies: Map<ADRRef, TechnologySlug[]>;
  adrProject: Map<ADRRef, ProjectSlug>;
  adrSupersedes: Map<ADRRef, ADRRef>;
  adrInheritsFrom: Map<ADRRef, ADRRef>;
  roleTechnologies: Map<RoleSlug, TechnologySlug[]>;
  blogRole: Map<BlogSlug, RoleSlug>;
}

export function createEmptyRelationData(): RelationData {
  return {
    projectTechnologies: new Map(),
    projectADRs: new Map(),
    projectRole: new Map(),
    projectTags: new Map(),
    blogTechnologies: new Map(),
    blogTags: new Map(),
    adrTechnologies: new Map(),
    adrProject: new Map(),
    adrSupersedes: new Map(),
    adrInheritsFrom: new Map(),
    roleTechnologies: new Map(),
    blogRole: new Map(),
  };
}

interface BuildGraphInput {
  technologySlugs: Iterable<TechnologySlug>;
  projectSlugs: Iterable<ProjectSlug>;
  relations: RelationData;
}

export function buildContentGraph(input: BuildGraphInput): ContentGraph {
  const { technologySlugs, projectSlugs, relations } = input;

  const graph: ContentGraph = {
    edges: {
      usesTechnology: new Map(),
      partOfProject: new Map(),
      supersedes: new Map(),
      inheritsFrom: new Map(),
      hasTag: new Map(),
      createdAtRole: new Map(),
      writtenAtRole: new Map(),
    },
    reverse: {
      technologyUsedBy: new Map(),
      projectADRs: new Map(),
      supersededBy: new Map(),
      inheritedBy: new Map(),
      tagUsedBy: new Map(),
      roleProjects: new Map(),
      roleBlogs: new Map(),
    },
  };

  for (const techSlug of technologySlugs) {
    graph.reverse.technologyUsedBy.set(techSlug, new Set());
  }
  for (const projectSlug of projectSlugs) {
    graph.reverse.projectADRs.set(projectSlug, new Set());
  }

  for (const [slug, technologies] of relations.projectTechnologies) {
    addTechnologyEdges(graph, makeNodeId("project", slug), technologies);
  }
  for (const [slug, tags] of relations.projectTags) {
    addTagEdges(graph, makeNodeId("project", slug), tags);
  }
  for (const [projectSlug, adrRefs] of relations.projectADRs) {
    for (const adrRef of adrRefs) {
      graph.reverse.projectADRs.get(projectSlug)?.add(adrRef);
    }
  }

  for (const [slug, technologies] of relations.adrTechnologies) {
    addTechnologyEdges(graph, makeNodeId("adr", slug), technologies);
  }
  for (const [slug, projectSlug] of relations.adrProject) {
    graph.edges.partOfProject.set(slug, projectSlug);
    graph.reverse.projectADRs.get(projectSlug)?.add(slug);
  }
  for (const [supersedingSlug, supersededSlug] of relations.adrSupersedes) {
    graph.edges.supersedes.set(supersedingSlug, supersededSlug);
    graph.reverse.supersededBy.set(supersededSlug, supersedingSlug);
  }
  for (const [childAdrRef, parentAdrRef] of relations.adrInheritsFrom) {
    graph.edges.inheritsFrom.set(childAdrRef, parentAdrRef);
    if (!graph.reverse.inheritedBy.has(parentAdrRef)) {
      graph.reverse.inheritedBy.set(parentAdrRef, new Set());
    }
    graph.reverse.inheritedBy.get(parentAdrRef)?.add(childAdrRef);
  }

  for (const [slug, technologies] of relations.blogTechnologies) {
    addTechnologyEdges(graph, makeNodeId("blog", slug), technologies);
  }
  for (const [slug, tags] of relations.blogTags) {
    addTagEdges(graph, makeNodeId("blog", slug), tags);
  }

  for (const [slug, technologies] of relations.roleTechnologies) {
    addTechnologyEdges(graph, makeNodeId("role", slug), technologies);
  }

  for (const [projectSlug, roleSlug] of relations.projectRole) {
    graph.edges.createdAtRole.set(projectSlug, roleSlug);
    if (!graph.reverse.roleProjects.has(roleSlug)) {
      graph.reverse.roleProjects.set(roleSlug, new Set());
    }
    graph.reverse.roleProjects.get(roleSlug)?.add(projectSlug);
  }

  for (const [blogSlug, roleSlug] of relations.blogRole) {
    graph.edges.writtenAtRole.set(blogSlug, roleSlug);
    if (!graph.reverse.roleBlogs.has(roleSlug)) {
      graph.reverse.roleBlogs.set(roleSlug, new Set());
    }
    graph.reverse.roleBlogs.get(roleSlug)?.add(blogSlug);
  }

  return graph;
}

function addTechnologyEdges(
  graph: ContentGraph,
  nodeId: NodeId,
  technologies: TechnologySlug[],
): void {
  if (technologies.length === 0) return;
  graph.edges.usesTechnology.set(nodeId, new Set(technologies));
  for (const tech of technologies) {
    graph.reverse.technologyUsedBy.get(tech)?.add(nodeId);
  }
}

function addTagEdges(
  graph: ContentGraph,
  nodeId: NodeId,
  tags: string[],
): void {
  if (tags.length === 0) return;
  graph.edges.hasTag.set(nodeId, new Set(tags));
  for (const tag of tags) {
    if (!graph.reverse.tagUsedBy.has(tag)) {
      graph.reverse.tagUsedBy.set(tag, new Set());
    }
    graph.reverse.tagUsedBy.get(tag)?.add(nodeId);
  }
}
