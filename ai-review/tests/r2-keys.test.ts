import { describe, expect, it } from "vitest";
import {
  findingEvidenceKey,
  findingOutcomeKey,
  findingRecordsPrefix,
  reviewRunTerminalKey,
} from "../src/r2-keys";

describe("AI review R2 keys", () => {
  const pullRequest = {
    repository: "acme/widgets",
    pullRequestNumber: 7,
  };

  it("keeps finding outcomes on the scorecard fixture path", () => {
    expect(findingRecordsPrefix(pullRequest)).toBe(
      "v2/acme/widgets/pr-7/findings",
    );
    expect(
      findingOutcomeKey({
        ...pullRequest,
        findingId: "f_fixed",
        outcomeVersion: 2,
      }),
    ).toBe("v2/acme/widgets/pr-7/findings/f_fixed/outcomes/v2.json");
  });

  it("keeps interaction evidence beside its finding", () => {
    expect(
      findingEvidenceKey({
        ...pullRequest,
        findingId: "f_fixed",
        deliveryId: "delivery-1",
      }),
    ).toBe("v2/acme/widgets/pr-7/findings/f_fixed/evidence/delivery-1.json");
  });

  it("keeps terminal records on the scorecard fixture path", () => {
    expect(
      reviewRunTerminalKey({
        ...pullRequest,
        headSha: "head-1",
        instanceId: "run-1",
        status: "published",
      }),
    ).toBe("v2/acme/widgets/pr-7/head-1/run-1/published.json");
  });
});
