import type { ADRSlug } from "@/lib/domain/adr/adr";
import type { BlogSlug } from "@/lib/domain/blog/blogPost";
import type { ProjectSlug } from "@/lib/domain/project/project";
import type { RoleSlug } from "@/lib/domain/role/jobRole";
import type { TechnologySlug } from "@/lib/domain/technology/technology";

// Recipe types live in the separate RecipeRepository - see @/lib/domain/recipe/recipeGraph

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
  | "HAS_TAG"
  | "CREATED_AT_ROLE"
  | "WRITTEN_AT_ROLE";

export interface ContentGraph {
  edges: {
    usesTechnology: Map<NodeId, Set<TechnologySlug>>;
    partOfProject: Map<ADRSlug, ProjectSlug>;
    supersedes: Map<ADRSlug, ADRSlug>;
    hasTag: Map<NodeId, Set<string>>;
    createdAtRole: Map<ProjectSlug, RoleSlug>;
    writtenAtRole: Map<BlogSlug, RoleSlug>;
  };

  reverse: {
    technologyUsedBy: Map<TechnologySlug, Set<NodeId>>;
    projectADRs: Map<ProjectSlug, Set<ADRSlug>>;
    supersededBy: Map<ADRSlug, ADRSlug>;
    tagUsedBy: Map<string, Set<NodeId>>;
    roleProjects: Map<RoleSlug, Set<ProjectSlug>>;
    roleBlogs: Map<RoleSlug, Set<BlogSlug>>;
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
