import type { DomainRepository } from "@/lib/domain";
import type { NodeType } from "@/lib/repository/graph";

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
  for (const [slug, adr] of adrs) {
    const projectSlug = graph.edges.partOfProject.get(slug);
    nodes.push({
      id: `adr:${slug}`,
      name: adr.title,
      type: "adr",
      href: projectSlug
        ? `/projects/${projectSlug}/adrs/${slug}`
        : `/projects/personal-site/adrs/${slug}`,
      connections: 0,
    });
  }
  const connectedTechs = new Set<string>();
  for (const [techSlug, usedBy] of graph.reverse.technologyUsedBy) {
    if (usedBy.size > 0) {
      connectedTechs.add(techSlug);
      const tech = technologies.get(techSlug);
      if (tech) {
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
        href: "#",
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
  for (const [adrSlug, projectSlug] of graph.edges.partOfProject) {
    edges.push({
      source: `adr:${adrSlug}`,
      target: `project:${projectSlug}`,
      type: "PART_OF_PROJECT",
    });
    addConnection(`adr:${adrSlug}`);
    addConnection(`project:${projectSlug}`);
  }
  for (const [supersedingSlug, supersededSlug] of graph.edges.supersedes) {
    edges.push({
      source: `adr:${supersedingSlug}`,
      target: `adr:${supersededSlug}`,
      type: "SUPERSEDES",
    });
    addConnection(`adr:${supersedingSlug}`);
    addConnection(`adr:${supersededSlug}`);
  }
  for (const [projectSlug, roleSlug] of graph.edges.createdAtRole) {
    edges.push({
      source: `project:${projectSlug}`,
      target: `role:${roleSlug}`,
      type: "CREATED_AT_ROLE",
    });
    addConnection(`project:${projectSlug}`);
    addConnection(`role:${roleSlug}`);
  }
  for (const [blogSlug, roleSlug] of graph.edges.writtenAtRole) {
    edges.push({
      source: `blog:${blogSlug}`,
      target: `role:${roleSlug}`,
      type: "WRITTEN_AT_ROLE",
    });
    addConnection(`blog:${blogSlug}`);
    addConnection(`role:${roleSlug}`);
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
