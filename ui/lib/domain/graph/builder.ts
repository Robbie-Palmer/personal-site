import type { ADRSlug } from "../adr/adr";
import type { BlogSlug } from "../blog/blogPost";
import type { ProjectSlug } from "../project/project";
import type { RoleSlug } from "../role/jobRole";
import type { TechnologySlug } from "../technology/technology";
import { type ContentGraph, makeNodeId, type NodeId } from "./types";

export interface RelationData {
  projectTechnologies: Map<ProjectSlug, TechnologySlug[]>;
  projectADRs: Map<ProjectSlug, ADRSlug[]>;
  blogTechnologies: Map<BlogSlug, TechnologySlug[]>;
  blogTags: Map<BlogSlug, string[]>;
  adrTechnologies: Map<ADRSlug, TechnologySlug[]>;
  adrProject: Map<ADRSlug, ProjectSlug>;
  adrSupersededBy: Map<ADRSlug, ADRSlug>;
  roleTechnologies: Map<RoleSlug, TechnologySlug[]>;
}

export function createEmptyRelationData(): RelationData {
  return {
    projectTechnologies: new Map(),
    projectADRs: new Map(),
    blogTechnologies: new Map(),
    blogTags: new Map(),
    adrTechnologies: new Map(),
    adrProject: new Map(),
    adrSupersededBy: new Map(),
    roleTechnologies: new Map(),
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
      hasTag: new Map(),
    },
    reverse: {
      technologyUsedBy: new Map(),
      projectADRs: new Map(),
      supersededBy: new Map(),
      tagUsedBy: new Map(),
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

  for (const [slug, technologies] of relations.adrTechnologies) {
    addTechnologyEdges(graph, makeNodeId("adr", slug), technologies);
  }
  for (const [slug, projectSlug] of relations.adrProject) {
    graph.edges.partOfProject.set(slug, projectSlug);
    graph.reverse.projectADRs.get(projectSlug)?.add(slug);
  }
  for (const [supersedingSlug, supersededSlug] of relations.adrSupersededBy) {
    graph.edges.supersedes.set(supersedingSlug, supersededSlug);
    graph.reverse.supersededBy.set(supersededSlug, supersedingSlug);
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
    graph.reverse.tagUsedBy.get(tag)!.add(nodeId);
  }
}
