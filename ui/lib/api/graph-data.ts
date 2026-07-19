import type { DomainRepository } from "@/lib/domain";
import { normalizeADRTitle, parseADRRef } from "@/lib/domain/adr/adr";
import type { NodeType } from "@/lib/repository/graph";

export const NON_NAVIGABLE_HREF = "#";

export interface GraphNode {
  id: string;
  name: string;
  type: NodeType | "tag";
  href: string;
  connections: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

type GraphBuildState = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  connectionCounts: Map<string, number>;
};

function addConnection(state: GraphBuildState, id: string): void {
  state.connectionCounts.set(id, (state.connectionCounts.get(id) ?? 0) + 1);
}

function addEdge(
  state: GraphBuildState,
  source: string,
  target: string,
  type: string,
): void {
  state.edges.push({ source, target, type });
  addConnection(state, source);
  addConnection(state, target);
}

function addContentNodes(
  repository: DomainRepository,
  state: GraphBuildState,
): void {
  for (const [slug, project] of repository.projects) {
    state.nodes.push({
      id: `project:${slug}`,
      name: project.title,
      type: "project",
      href: `/projects/${slug}`,
      connections: 0,
    });
  }
  for (const [slug, blog] of repository.blogs) {
    state.nodes.push({
      id: `blog:${slug}`,
      name: blog.title,
      type: "blog",
      href: `/blog/${slug}`,
      connections: 0,
    });
  }
  for (const [slug, role] of repository.roles) {
    state.nodes.push({
      id: `role:${slug}`,
      name: `${role.title} @ ${role.company}`,
      type: "role",
      href: `/experience#${slug}`,
      connections: 0,
    });
  }
}

function addAdrNodes(
  repository: DomainRepository,
  state: GraphBuildState,
): void {
  for (const [adrRef, adr] of repository.adrs) {
    const projectSlug = repository.graph.edges.partOfProject.get(adrRef);
    if (!projectSlug) continue;
    const { adrSlug } = parseADRRef(adrRef);
    const displayTitle = normalizeADRTitle(adr.title);
    const localIndex = /^(\d+)/.exec(adrSlug)?.[1];
    state.nodes.push({
      id: `adr:${adrRef}`,
      name: localIndex ? `ADR ${localIndex}: ${displayTitle}` : adr.title,
      type: "adr",
      href: `/projects/${projectSlug}/adrs/${adrSlug}`,
      connections: 0,
    });
  }
}

function addTechnologyAndTagNodes(
  repository: DomainRepository,
  state: GraphBuildState,
): Set<string> {
  const connectedTechs = new Set<string>();
  for (const [techSlug, usedBy] of repository.graph.reverse.technologyUsedBy) {
    if (usedBy.size === 0) continue;
    const tech = repository.technologies.get(techSlug);
    if (!tech) continue;
    connectedTechs.add(techSlug);
    state.nodes.push({
      id: `technology:${techSlug}`,
      name: tech.name,
      type: "technology",
      href: `/technologies/${techSlug}`,
      connections: 0,
    });
  }
  for (const [tag, usedBy] of repository.graph.reverse.tagUsedBy) {
    if (usedBy.size === 0) continue;
    state.nodes.push({
      id: `tag:${tag}`,
      name: `#${tag}`,
      type: "tag",
      href: NON_NAVIGABLE_HREF,
      connections: 0,
    });
  }
  return connectedTechs;
}

function addTechnologyEdges(
  repository: DomainRepository,
  state: GraphBuildState,
  connectedTechs: ReadonlySet<string>,
): void {
  for (const [nodeId, techSlugs] of repository.graph.edges.usesTechnology) {
    for (const techSlug of techSlugs) {
      if (connectedTechs.has(techSlug)) {
        addEdge(state, nodeId, `technology:${techSlug}`, "USES_TECHNOLOGY");
      }
    }
  }
}

function addMappedEdges(
  state: GraphBuildState,
  entries: ReadonlyMap<string, string>,
  sourceId: (value: string) => string,
  targetId: (value: string) => string,
  type: string,
): void {
  const nodeIds = new Set(state.nodes.map((node) => node.id));
  for (const [sourceValue, targetValue] of entries) {
    const source = sourceId(sourceValue);
    const target = targetId(targetValue);
    if (nodeIds.has(source) && nodeIds.has(target)) {
      addEdge(state, source, target, type);
    }
  }
}

function addRelationshipEdges(
  repository: DomainRepository,
  state: GraphBuildState,
): void {
  addMappedEdges(
    state,
    repository.graph.edges.partOfProject,
    (ref) => `adr:${ref}`,
    (slug) => `project:${slug}`,
    "PART_OF_PROJECT",
  );
  addMappedEdges(
    state,
    repository.graph.edges.supersedes,
    (ref) => `adr:${ref}`,
    (ref) => `adr:${ref}`,
    "SUPERSEDES",
  );
  addMappedEdges(
    state,
    repository.graph.edges.inheritsFrom,
    (ref) => `adr:${ref}`,
    (ref) => `adr:${ref}`,
    "INHERITS_FROM",
  );
  addMappedEdges(
    state,
    repository.graph.edges.createdAtRole,
    (slug) => `project:${slug}`,
    (slug) => `role:${slug}`,
    "CREATED_AT_ROLE",
  );
  addMappedEdges(
    state,
    repository.graph.edges.writtenAtRole,
    (slug) => `blog:${slug}`,
    (slug) => `role:${slug}`,
    "WRITTEN_AT_ROLE",
  );
}

function addTagEdges(
  repository: DomainRepository,
  state: GraphBuildState,
): void {
  for (const [nodeId, tags] of repository.graph.edges.hasTag) {
    for (const tag of tags) {
      addEdge(state, nodeId, `tag:${tag}`, "HAS_TAG");
    }
  }
}

export function extractGraphData(repository: DomainRepository): GraphData {
  const state: GraphBuildState = {
    nodes: [],
    edges: [],
    connectionCounts: new Map(),
  };
  addContentNodes(repository, state);
  addAdrNodes(repository, state);
  const connectedTechs = addTechnologyAndTagNodes(repository, state);
  addTechnologyEdges(repository, state, connectedTechs);
  addRelationshipEdges(repository, state);
  addTagEdges(repository, state);

  for (const node of state.nodes) {
    node.connections = state.connectionCounts.get(node.id) ?? 0;
  }
  return { nodes: state.nodes, edges: state.edges };
}
