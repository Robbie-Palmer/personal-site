import { describe, it } from "vitest";

describe("execution leases", () => {
  it.todo("creates a lease only for eligible work");
  it.todo("prevents another active lease on the same work item");
  it.todo("keeps claimed work assigned when higher-priority work becomes ready");
  it.todo("renews only the current lease and epoch");
  it.todo("allows another worker to reclaim an expired lease");
  it.todo("increments the epoch when stale work is reclaimed");
  it.todo("rejects delayed mutations carrying an obsolete lease epoch");
  it.todo("retains immutable lease and outcome history");
  it.todo("selects a specified eligible item without a separate read step");
});
