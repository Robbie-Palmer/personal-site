export type WorkGraphErrorCode =
  | "dependency_already_exists"
  | "dependency_not_found"
  | "duplicate_lease_id"
  | "duplicate_work_item"
  | "graph_cycle"
  | "invalid_decomposition"
  | "invalid_lease_duration"
  | "invalid_lease_epoch"
  | "invalid_lease_id"
  | "invalid_parent_id"
  | "invalid_worker_id"
  | "invalid_work_item_id"
  | "invalid_work_item_lifecycle"
  | "invalid_work_item_title"
  | "lease_not_current"
  | "self_dependency"
  | "work_item_already_terminal"
  | "work_item_has_current_lease"
  | "work_item_not_found";

export class WorkGraphError extends Error {
  readonly code: WorkGraphErrorCode;

  constructor(code: WorkGraphErrorCode, message: string) {
    super(message);
    this.name = "WorkGraphError";
    this.code = code;
  }
}
