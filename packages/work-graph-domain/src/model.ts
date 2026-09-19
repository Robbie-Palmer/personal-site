import type { KnowledgeScopeKind, WorkItemLifecycle } from "./vocabulary";

export interface KnowledgeScope {
  readonly id: string;
  readonly kind: KnowledgeScopeKind;
  readonly title: string;
  readonly canonicalUrl: string;
  readonly markdownUrl: string;
  readonly sourceRevision: string | null;
  readonly rank: number | null;
}

export interface KnowledgeScopeInput {
  readonly id: string;
  readonly kind: KnowledgeScopeKind;
  readonly title: string;
  readonly canonicalUrl: string;
  readonly markdownUrl: string;
  readonly sourceRevision?: string | null;
  readonly rank?: number | null;
}

export interface KnowledgeScopeRelationship {
  readonly parentKnowledgeScopeId: string;
  readonly childKnowledgeScopeId: string;
}

export interface WorkItem {
  readonly id: string;
  readonly title: string;
  readonly lifecycle: WorkItemLifecycle;
  readonly parentId: string | null;
  readonly rank: number | null;
  readonly priorityRank: number | null;
  readonly schedulingInitiativeId: string | null;
  readonly schedulingProjectId: string | null;
  readonly expedited: boolean;
  readonly expediteReason: string | null;
}

export interface WorkItemInput {
  readonly id: string;
  readonly title: string;
  readonly lifecycle?: WorkItemLifecycle;
  readonly parentId?: string | null;
  readonly rank?: number | null;
  readonly priorityRank?: number | null;
  readonly schedulingInitiativeId?: string | null;
  readonly schedulingProjectId?: string | null;
  readonly expedited?: boolean;
  readonly expediteReason?: string | null;
}

export type NewWorkItemInput = Omit<WorkItemInput, "lifecycle" | "rank">;

export interface WorkItemDependency {
  readonly dependentWorkItemId: string;
  readonly blockerWorkItemId: string;
}

export interface WorkGraph {
  readonly workItems: readonly WorkItem[];
  readonly dependencies: readonly WorkItemDependency[];
}

export interface WorkGraphInput {
  readonly workItems?: readonly WorkItemInput[];
  readonly dependencies?: readonly WorkItemDependency[];
}

export interface WorkItemLeaseProjection {
  readonly expiresAt: number;
}

export interface WorkItemOperationalState {
  readonly currentLease?: WorkItemLeaseProjection | null;
  readonly hasUnresolvedBlockingAttention?: boolean;
  readonly now?: number;
}
