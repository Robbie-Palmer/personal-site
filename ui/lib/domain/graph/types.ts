import type { ADRSlug } from "../adr/adr";
import type { BlogSlug } from "../blog/blogPost";
import type { ProjectSlug } from "../project/project";
import type { RoleSlug } from "../role/jobRole";
import type { TechnologySlug } from "../technology/technology";

export type NodeType = "project" | "adr" | "blog" | "role" | "technology";

export type NodeId =
  | `project:${string}`
  | `adr:${string}`
  | `blog:${string}`
  | `role:${string}`
  | `technology:${string}`;

export type EdgeType =
  | "USES_TECHNOLOGY"
  | "PART_OF_PROJECT"
  | "SUPERSEDES"
  | "HAS_TAG";

export type EdgeDefinition =
  | {
      type: "USES_TECHNOLOGY";
      from: ProjectSlug | ADRSlug | BlogSlug | RoleSlug;
      to: TechnologySlug;
    }
  | { type: "PART_OF_PROJECT"; from: ADRSlug; to: ProjectSlug }
  | { type: "SUPERSEDES"; from: ADRSlug; to: ADRSlug }
  | { type: "HAS_TAG"; from: NodeId; to: string };

export interface ContentGraph {
  edges: {
    usesTechnology: Map<NodeId, Set<TechnologySlug>>;
    partOfProject: Map<ADRSlug, ProjectSlug>;
    supersedes: Map<ADRSlug, ADRSlug>;
    hasTag: Map<NodeId, Set<string>>;
  };

  reverse: {
    technologyUsedBy: Map<TechnologySlug, Set<NodeId>>;
    projectADRs: Map<ProjectSlug, Set<ADRSlug>>;
    supersededBy: Map<ADRSlug, ADRSlug>;
    tagUsedBy: Map<string, Set<NodeId>>;
  };
}

export function makeNodeId<T extends NodeType>(type: T, slug: string): NodeId {
  return `${type}:${slug}` as NodeId;
}

export function parseNodeId(id: NodeId): { type: NodeType; slug: string } {
  const colonIndex = id.indexOf(":");
  return {
    type: id.slice(0, colonIndex) as NodeType,
    slug: id.slice(colonIndex + 1),
  };
}

export function getNodeType(id: NodeId): NodeType {
  return id.slice(0, id.indexOf(":")) as NodeType;
}

export function getNodeSlug(id: NodeId): string {
  return id.slice(id.indexOf(":") + 1);
}

export function isNodeType<T extends NodeType>(
  id: NodeId,
  type: T,
): id is `${T}:${string}` {
  return id.startsWith(`${type}:`);
}
