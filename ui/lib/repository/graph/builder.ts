import type { ADRRef } from "@/lib/domain/adr/adr";
import type { BlogSlug } from "@/lib/domain/blog/blogPost";
import type { IdeaSlug } from "@/lib/domain/idea/idea";
import type { InitiativeSlug } from "@/lib/domain/initiative/initiative";
import type { ProjectSlug } from "@/lib/domain/project/project";
import type { RoleSlug } from "@/lib/domain/role/jobRole";
import type { TechnologySlug } from "@/lib/domain/technology/technology";
import { type ContentGraph, makeNodeId, type NodeId } from "./types";

export interface RelationData {
  projectTechnologies: Map<ProjectSlug, TechnologySlug[]>;
  projectADRs: Map<ProjectSlug, ADRRef[]>;
  projectRole: Map<ProjectSlug, RoleSlug>;
  projectTags: Map<ProjectSlug, string[]>;
  projectInitiatives: Map<ProjectSlug, InitiativeSlug[]>;
  blogTechnologies: Map<BlogSlug, TechnologySlug[]>;
  blogIdeas: Map<BlogSlug, IdeaSlug[]>;
  blogTags: Map<BlogSlug, string[]>;
  adrTechnologies: Map<ADRRef, TechnologySlug[]>;
  adrIdeas: Map<ADRRef, IdeaSlug[]>;
  adrProject: Map<ADRRef, ProjectSlug>;
  adrSupersedes: Map<ADRRef, ADRRef>;
  adrInheritsFrom: Map<ADRRef, ADRRef>;
  roleTechnologies: Map<RoleSlug, TechnologySlug[]>;
  blogRole: Map<BlogSlug, RoleSlug>;
  projectIdeas: Map<ProjectSlug, IdeaSlug[]>;
  ideaRelatedIdeas: Map<IdeaSlug, IdeaSlug[]>;
}

export function createEmptyRelationData(): RelationData {
  return {
    projectTechnologies: new Map(),
    projectADRs: new Map(),
    projectRole: new Map(),
    projectTags: new Map(),
    projectInitiatives: new Map(),
    blogTechnologies: new Map(),
    blogIdeas: new Map(),
    blogTags: new Map(),
    adrTechnologies: new Map(),
    adrIdeas: new Map(),
    adrProject: new Map(),
    adrSupersedes: new Map(),
    adrInheritsFrom: new Map(),
    roleTechnologies: new Map(),
    blogRole: new Map(),
    projectIdeas: new Map(),
    ideaRelatedIdeas: new Map(),
  };
}

interface BuildGraphInput {
  technologySlugs: Iterable<TechnologySlug>;
  projectSlugs: Iterable<ProjectSlug>;
  initiativeSlugs?: Iterable<InitiativeSlug>;
  ideaSlugs?: Iterable<IdeaSlug>;
  relations: RelationData;
}

export function buildContentGraph(input: BuildGraphInput): ContentGraph {
  const {
    technologySlugs,
    projectSlugs,
    initiativeSlugs = [],
    ideaSlugs = [],
    relations,
  } = input;

  const graph: ContentGraph = {
    edges: {
      usesTechnology: new Map(),
      partOfProject: new Map(),
      supersedes: new Map(),
      inheritsFrom: new Map(),
      hasTag: new Map(),
      contributesToInitiative: new Map(),
      createdAtRole: new Map(),
      writtenAtRole: new Map(),
      referencesIdea: new Map(),
      relatedIdea: new Map(),
    },
    reverse: {
      technologyUsedBy: new Map(),
      projectADRs: new Map(),
      supersededBy: new Map(),
      inheritedBy: new Map(),
      tagUsedBy: new Map(),
      initiativeProjects: new Map(),
      roleProjects: new Map(),
      roleBlogs: new Map(),
      ideaReferencedBy: new Map(),
    },
  };

  for (const techSlug of technologySlugs) {
    graph.reverse.technologyUsedBy.set(techSlug, new Set());
  }
  for (const projectSlug of projectSlugs) {
    graph.reverse.projectADRs.set(projectSlug, new Set());
  }
  for (const initiativeSlug of initiativeSlugs) {
    graph.reverse.initiativeProjects.set(initiativeSlug, new Set());
  }
  for (const ideaSlug of ideaSlugs) {
    graph.reverse.ideaReferencedBy.set(ideaSlug, new Set());
  }

  for (const [slug, technologies] of relations.projectTechnologies) {
    addTechnologyEdges(graph, makeNodeId("project", slug), technologies);
  }
  for (const [slug, tags] of relations.projectTags) {
    addTagEdges(graph, makeNodeId("project", slug), tags);
  }
  for (const [slug, ideas] of relations.projectIdeas) {
    addIdeaEdges(graph, makeNodeId("project", slug), ideas);
  }
  for (const [projectSlug, initiatives] of relations.projectInitiatives) {
    if (initiatives.length === 0) continue;
    graph.edges.contributesToInitiative.set(projectSlug, new Set(initiatives));
    for (const initiativeSlug of initiatives) {
      graph.reverse.initiativeProjects.get(initiativeSlug)?.add(projectSlug);
    }
  }
  for (const [projectSlug, adrRefs] of relations.projectADRs) {
    for (const adrRef of adrRefs) {
      graph.reverse.projectADRs.get(projectSlug)?.add(adrRef);
    }
  }

  for (const [slug, technologies] of relations.adrTechnologies) {
    addTechnologyEdges(graph, makeNodeId("adr", slug), technologies);
  }
  for (const [slug, ideas] of relations.adrIdeas) {
    addIdeaEdges(graph, makeNodeId("adr", slug), ideas);
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
  for (const [slug, ideas] of relations.blogIdeas) {
    addIdeaEdges(graph, makeNodeId("blog", slug), ideas);
  }

  for (const [slug, relatedIdeas] of relations.ideaRelatedIdeas) {
    if (relatedIdeas.length > 0) {
      graph.edges.relatedIdea.set(slug, new Set(relatedIdeas));
    }
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

function addIdeaEdges(
  graph: ContentGraph,
  nodeId: NodeId,
  ideas: IdeaSlug[],
): void {
  if (ideas.length === 0) return;
  graph.edges.referencesIdea.set(nodeId, new Set(ideas));
  for (const idea of ideas) {
    graph.reverse.ideaReferencedBy.get(idea)?.add(nodeId);
  }
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
