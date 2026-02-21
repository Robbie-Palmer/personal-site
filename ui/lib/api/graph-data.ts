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

export function extractGraphData(repository: DomainRepository): GraphData {
  const { graph, technologies, projects, blogs, adrs, roles } = repository;
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const connectionCounts = new Map<string, number>();

  function addConnection(id: string) {
    connectionCounts.set(id, (connectionCounts.get(id) ?? 0) + 1);
  }

  for (const [slug, project] of projects) {
    nodes.push({
      id: `project:${slug}`,
      name: project.title,
      type: "project",
      href: `/projects/${slug}`,
      connections: 0,
    });
  }
  for (const [slug, blog] of blogs) {
    nodes.push({
      id: `blog:${slug}`,
      name: blog.title,
      type: "blog",
      href: `/blog/${slug}`,
      connections: 0,
    });
  }
  for (const [slug, role] of roles) {
    nodes.push({
      id: `role:${slug}`,
      name: `${role.title} @ ${role.company}`,
      type: "role",
      href: `/experience#${slug}`,
      connections: 0,
    });
  }
  for (const [adrRef, adr] of adrs) {
    const projectSlug = graph.edges.partOfProject.get(adrRef);
    if (!projectSlug) continue;
    const { adrSlug } = parseADRRef(adrRef);
    const displayTitle = normalizeADRTitle(adr.title);
    const localIndex = adrSlug.match(/^(\d+)/)?.[1];
    nodes.push({
      id: `adr:${adrRef}`,
      name: localIndex ? `ADR ${localIndex}: ${displayTitle}` : adr.title,
      type: "adr",
      href: `/projects/${projectSlug}/adrs/${adrSlug}`,
      connections: 0,
    });
  }
  const connectedTechs = new Set<string>();
  for (const [techSlug, usedBy] of graph.reverse.technologyUsedBy) {
    if (usedBy.size > 0) {
      const tech = technologies.get(techSlug);
      if (tech) {
        connectedTechs.add(techSlug);
        nodes.push({
          id: `technology:${techSlug}`,
          name: tech.name,
          type: "technology",
          href: `/technologies/${techSlug}`,
          connections: 0,
        });
      }
    }
  }
  for (const [tag, usedBy] of graph.reverse.tagUsedBy) {
    if (usedBy.size > 0) {
      nodes.push({
        id: `tag:${tag}`,
        name: `#${tag}`,
        type: "tag",
        href: NON_NAVIGABLE_HREF,
        connections: 0,
      });
    }
  }
  for (const [nodeId, techSlugs] of graph.edges.usesTechnology) {
    for (const techSlug of techSlugs) {
      if (connectedTechs.has(techSlug)) {
        edges.push({
          source: nodeId,
          target: `technology:${techSlug}`,
          type: "USES_TECHNOLOGY",
        });
        addConnection(nodeId);
        addConnection(`technology:${techSlug}`);
      }
    }
  }
  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const [adrRef, projectSlug] of graph.edges.partOfProject) {
    const source = `adr:${adrRef}`;
    const target = `project:${projectSlug}`;
    if (!nodeIds.has(source) || !nodeIds.has(target)) continue;
    edges.push({ source, target, type: "PART_OF_PROJECT" });
    addConnection(source);
    addConnection(target);
  }
  for (const [supersedingRef, supersededRef] of graph.edges.supersedes) {
    const source = `adr:${supersedingRef}`;
    const target = `adr:${supersededRef}`;
    if (!nodeIds.has(source) || !nodeIds.has(target)) continue;
    edges.push({ source, target, type: "SUPERSEDES" });
    addConnection(source);
    addConnection(target);
  }
  for (const [childRef, parentRef] of graph.edges.inheritsFrom) {
    const source = `adr:${childRef}`;
    const target = `adr:${parentRef}`;
    if (!nodeIds.has(source) || !nodeIds.has(target)) continue;
    edges.push({ source, target, type: "INHERITS_FROM" });
    addConnection(source);
    addConnection(target);
  }
  for (const [projectSlug, roleSlug] of graph.edges.createdAtRole) {
    const source = `project:${projectSlug}`;
    const target = `role:${roleSlug}`;
    if (!nodeIds.has(source) || !nodeIds.has(target)) continue;
    edges.push({ source, target, type: "CREATED_AT_ROLE" });
    addConnection(source);
    addConnection(target);
  }
  for (const [blogSlug, roleSlug] of graph.edges.writtenAtRole) {
    const source = `blog:${blogSlug}`;
    const target = `role:${roleSlug}`;
    if (!nodeIds.has(source) || !nodeIds.has(target)) continue;
    edges.push({ source, target, type: "WRITTEN_AT_ROLE" });
    addConnection(source);
    addConnection(target);
  }
  for (const [nodeId, tags] of graph.edges.hasTag) {
    for (const tag of tags) {
      edges.push({
        source: nodeId,
        target: `tag:${tag}`,
        type: "HAS_TAG",
      });
      addConnection(nodeId);
      addConnection(`tag:${tag}`);
    }
  }
  for (const node of nodes) {
    node.connections = connectionCounts.get(node.id) ?? 0;
  }
  return { nodes, edges };
}
