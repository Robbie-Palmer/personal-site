export type WorkGraphErrorCode =
  | "attention_request_already_resolved"
  | "attention_request_not_found"
  | "dependency_already_exists"
  | "dependency_not_found"
  | "duplicate_attention_request"
  | "duplicate_attention_resolution"
  | "duplicate_lease_id"
  | "duplicate_note"
  | "duplicate_work_item"
  | "graph_cycle"
  | "idempotency_key_reused"
  | "invalid_attention_kind"
  | "invalid_attention_question"
  | "invalid_attention_request_id"
  | "invalid_attention_resolution"
  | "invalid_attention_resolution_id"
  | "invalid_decomposition"
  | "invalid_idempotency_key"
  | "invalid_lease_duration"
  | "invalid_lease_epoch"
  | "invalid_lease_id"
  | "invalid_note_content"
  | "invalid_note_id"
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
