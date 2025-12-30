import type { ADR, ADRSlug } from "../adr/adr";
import type { BlogPost, BlogSlug } from "../blog/blogPost";
import type { Project, ProjectSlug } from "../project/project";
import type { JobRole, RoleSlug } from "../role/jobRole";
import type { Technology, TechnologySlug } from "../technology/technology";
import { type ContentGraph, makeNodeId, type NodeId } from "./types";

interface DomainEntities {
  technologies: Map<TechnologySlug, Technology>;
  blogs: Map<BlogSlug, BlogPost>;
  projects: Map<ProjectSlug, Project>;
  adrs: Map<ADRSlug, ADR>;
  roles: Map<RoleSlug, JobRole>;
}

export function buildContentGraph(entities: DomainEntities): ContentGraph {
  const graph: ContentGraph = {
    edges: {
      usesTechnology: new Map(),
      partOfProject: new Map(),
      supersedes: new Map(),
    },
    reverse: {
      technologyUsedBy: new Map(),
      projectADRs: new Map(),
      supersededBy: new Map(),
    },
  };

  for (const techSlug of entities.technologies.keys()) {
    graph.reverse.technologyUsedBy.set(techSlug, new Set());
  }
  for (const projectSlug of entities.projects.keys()) {
    graph.reverse.projectADRs.set(projectSlug, new Set());
  }
  for (const [slug, project] of entities.projects) {
    addTechnologyEdges(
      graph,
      makeNodeId("project", slug),
      project.relations.technologies,
    );
  }
  for (const [slug, adr] of entities.adrs) {
    addTechnologyEdges(
      graph,
      makeNodeId("adr", slug),
      adr.relations.technologies,
    );
    graph.edges.partOfProject.set(slug, adr.relations.project);
    graph.reverse.projectADRs.get(adr.relations.project)?.add(slug);
    if (adr.supersededBy) {
      graph.edges.supersedes.set(adr.supersededBy, slug);
      graph.reverse.supersededBy.set(slug, adr.supersededBy);
    }
  }
  for (const [slug, blog] of entities.blogs) {
    addTechnologyEdges(
      graph,
      makeNodeId("blog", slug),
      blog.relations.technologies,
    );
  }
  for (const [slug, role] of entities.roles) {
    addTechnologyEdges(
      graph,
      makeNodeId("role", slug),
      role.relations.technologies,
    );
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
