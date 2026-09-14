export type WorkGraphErrorCode =
  | "dependency_already_exists"
  | "dependency_not_found"
  | "duplicate_work_item"
  | "graph_cycle"
  | "invalid_decomposition"
  | "invalid_parent_id"
  | "invalid_work_item_id"
  | "invalid_work_item_lifecycle"
  | "invalid_work_item_title"
  | "self_dependency"
  | "terminal_work_item"
  | "work_item_not_found";

export class WorkGraphError extends Error {
  readonly code: WorkGraphErrorCode;

  constructor(code: WorkGraphErrorCode, message: string) {
    super(message);
    this.name = "WorkGraphError";
    this.code = code;
  }
}
