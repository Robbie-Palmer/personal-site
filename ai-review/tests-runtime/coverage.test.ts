import { describe, expect, it } from "vitest";
import {
  decideReviewCoverage,
  reviewRiskSignals,
  type ReviewHunk,
} from "../src/review-engine";

function hunk(id: string, file = "app.ts"): ReviewHunk {
  return {
    hunkId: `h_${id.repeat(24)}`,
    fingerprint: id.repeat(64),
    file,
    oldStart: 1,
    oldLines: 1,
    newStart: 1,
    newLines: 1,
  };
}

describe("incremental review coverage in workerd", () => {
  it("reviews only new hunks and the unchanged hunk of an affected open finding", () => {
    const first = hunk("a");
    const unchanged = hunk("b", "other.ts");
    const added = hunk("c");
    const coverage = decideReviewCoverage({
      force: false,
      riskSignals: [],
      hunks: [first, unchanged, added],
      baseline: {
        headSha: "1".repeat(40),
        hunkIds: [first.hunkId, unchanged.hunkId],
        openFindings: [
          {
            findingId: `f_${"d".repeat(24)}`,
            file: "app.ts",
            title: "Still open",
            hunkIds: [first.hunkId],
          },
        ],
      },
    });

    expect(coverage).toMatchObject({
      mode: "incremental",
      reviewedHunkIds: [first.hunkId, added.hunkId],
      unchangedHunkIds: [unchanged.hunkId],
      affectedFindingIds: [`f_${"d".repeat(24)}`],
    });
  });

  it("deterministically skips an unchanged synchronize event", () => {
    const current = hunk("a");
    const options = {
      force: false,
      riskSignals: [] as string[],
      hunks: [current],
      baseline: {
        headSha: "1".repeat(40),
        hunkIds: [current.hunkId],
        openFindings: [],
      },
    };
    expect(decideReviewCoverage(options)).toEqual(decideReviewCoverage(options));
    expect(decideReviewCoverage(options)).toMatchObject({
      mode: "skipped",
      reviewedHunkIds: [],
      unchangedHunkIds: [current.hunkId],
    });
  });

  it("escalates risk and explicit requests to full coverage", () => {
    const current = [hunk("a"), hunk("b")];
    const baseline = {
      headSha: "1".repeat(40),
      hunkIds: current.map(({ hunkId }) => hunkId),
      openFindings: [],
    };
    expect(
      decideReviewCoverage({
        force: false,
        riskSignals: ["authentication-or-secrets"],
        hunks: current,
        baseline,
      }),
    ).toMatchObject({ mode: "full", reviewedHunkIds: baseline.hunkIds });
    expect(
      decideReviewCoverage({
        force: true,
        riskSignals: [],
        hunks: current,
        baseline,
      }),
    ).toMatchObject({
      mode: "full",
      reason: "explicit forced full review",
      reviewedHunkIds: baseline.hunkIds,
    });
  });

  it("classifies every full-review risk family from changed paths", () => {
    expect(
      reviewRiskSignals([
        "src/auth/session.ts",
        "drizzle/0001.sql",
        "infra/main.tf",
        ".github/workflows/deploy.yml",
      ]),
    ).toEqual([
      "authentication-or-secrets",
      "database-schema",
      "infrastructure",
      "ci-or-deployment",
    ]);
    expect(reviewRiskSignals(["src/component.tsx"])).toEqual([]);
  });
});
