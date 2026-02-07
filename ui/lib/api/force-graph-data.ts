import type { DomainRepository } from "@/lib/domain";
import type { NodeType } from "@/lib/repository/graph";

export interface ForceGraphNode {
  id: string;
  name: string;
  type: NodeType | "tag";
  href: string;
  connections: number;
}

export interface ForceGraphLink {
  // react-force-graph mutates these from strings to node object references
  // after the first render, so both types must be handled at runtime
  source: string | ForceGraphNode;
  target: string | ForceGraphNode;
  type: string;
}

export interface ForceGraphData {
  nodes: ForceGraphNode[];
  links: ForceGraphLink[];
}

export function extractForceGraphData(
  repository: DomainRepository,
): ForceGraphData {
  const { graph, technologies, projects, blogs, adrs, roles } = repository;
  const nodes: ForceGraphNode[] = [];
  const links: ForceGraphLink[] = [];
  const connectionCounts = new Map<string, number>();

  function addConnection(id: string) {
    connectionCounts.set(id, (connectionCounts.get(id) ?? 0) + 1);
  }

  // Add project nodes
  for (const [slug, project] of projects) {
    nodes.push({
      id: `project:${slug}`,
      name: project.title,
      type: "project",
      href: `/projects/${slug}`,
      connections: 0,
    });
  }

  // Add blog nodes
  for (const [slug, blog] of blogs) {
    nodes.push({
      id: `blog:${slug}`,
      name: blog.title,
      type: "blog",
      href: `/blog/${slug}`,
      connections: 0,
    });
  }

  // Add role nodes
  for (const [slug, role] of roles) {
    nodes.push({
      id: `role:${slug}`,
      name: `${role.title} @ ${role.company}`,
      type: "role",
      href: `/experience#${slug}`,
      connections: 0,
    });
  }

  // Add ADR nodes
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

  // Add technology nodes (only those with connections)
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

  // Add tag nodes (only those with connections)
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

  // USES_TECHNOLOGY edges
  for (const [nodeId, techSlugs] of graph.edges.usesTechnology) {
    for (const techSlug of techSlugs) {
      if (connectedTechs.has(techSlug)) {
        links.push({
          source: nodeId,
          target: `technology:${techSlug}`,
          type: "USES_TECHNOLOGY",
        });
        addConnection(nodeId);
        addConnection(`technology:${techSlug}`);
      }
    }
  }

  // PART_OF_PROJECT edges
  for (const [adrSlug, projectSlug] of graph.edges.partOfProject) {
    links.push({
      source: `adr:${adrSlug}`,
      target: `project:${projectSlug}`,
      type: "PART_OF_PROJECT",
    });
    addConnection(`adr:${adrSlug}`);
    addConnection(`project:${projectSlug}`);
  }

  // SUPERSEDES edges
  for (const [supersedingSlug, supersededSlug] of graph.edges.supersedes) {
    links.push({
      source: `adr:${supersedingSlug}`,
      target: `adr:${supersededSlug}`,
      type: "SUPERSEDES",
    });
    addConnection(`adr:${supersedingSlug}`);
    addConnection(`adr:${supersededSlug}`);
  }

  // CREATED_AT_ROLE edges
  for (const [projectSlug, roleSlug] of graph.edges.createdAtRole) {
    links.push({
      source: `project:${projectSlug}`,
      target: `role:${roleSlug}`,
      type: "CREATED_AT_ROLE",
    });
    addConnection(`project:${projectSlug}`);
    addConnection(`role:${roleSlug}`);
  }

  // WRITTEN_AT_ROLE edges
  for (const [blogSlug, roleSlug] of graph.edges.writtenAtRole) {
    links.push({
      source: `blog:${blogSlug}`,
      target: `role:${roleSlug}`,
      type: "WRITTEN_AT_ROLE",
    });
    addConnection(`blog:${blogSlug}`);
    addConnection(`role:${roleSlug}`);
  }

  // HAS_TAG edges
  for (const [nodeId, tags] of graph.edges.hasTag) {
    for (const tag of tags) {
      links.push({
        source: nodeId,
        target: `tag:${tag}`,
        type: "HAS_TAG",
      });
      addConnection(nodeId);
      addConnection(`tag:${tag}`);
    }
  }

  // Set connection counts on nodes
  for (const node of nodes) {
    node.connections = connectionCounts.get(node.id) ?? 0;
  }

  return { nodes, links };
}
