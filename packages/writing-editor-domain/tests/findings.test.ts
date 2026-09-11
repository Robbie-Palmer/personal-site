import { describe, expect, it } from "vitest";

import {
  createFinding,
  FindingSchema,
  verifyFindingSource,
} from "../src/findings";
import { sourceReference } from "../src/suggestions";

const source = "# Draft\n\nCafé is evidence, not merely polish.\n";
const sourceText = "is evidence, not";
const startByte = Buffer.from(source.slice(0, source.indexOf(sourceText)), "utf8").byteLength;

function finding() {
  return createFinding({
    producer: {
      id: "vale",
      version: "vale@3.20.0+rules.example",
      provenance: { kind: "rule", ruleId: "Unslop.ContrastFormula" },
    },
    source: sourceReference("docs/draft.md", "git:abc123", source),
    span: {
      startByte,
      endByte: startByte + Buffer.byteLength(sourceText),
      sourceText,
    },
    category: "style/contrast-formula",
    reason: "State the point directly.",
  });
}

describe("writing findings", () => {
  it("creates a stable identity without pretending to know a replacement", () => {
    const first = finding();
    const changedExplanation = createFinding({
      producer: first.producer,
      source: first.source,
      span: first.span,
      category: first.category,
      reason: "Rewrite the contrast as a direct statement.",
    });

    expect(first.recordType).toBe("writing-finding");
    expect(first.findingId).toBe(
      "finding:v1:f8ee68dd2851624a2b59449d9616468dbc869c87b6e1d063fbb06edf3131fe2a",
    );
    expect(changedExplanation.findingId).toBe(first.findingId);
    expect("replacement" in first).toBe(false);
    expect(verifyFindingSource(first, source)).toEqual({ ok: true });
  });

  it("rejects tampered IDs and reports stale source text", () => {
    const record = finding();
    expect(FindingSchema.safeParse({ ...record, category: "style/other" }).success)
      .toBe(false);

    const verification = verifyFindingSource(record, source.replace("evidence", "proof"));
    expect(verification.ok).toBe(false);
    if (verification.ok) throw new Error("expected source conflicts");
    expect(verification.conflicts.map(({ kind }) => kind)).toEqual([
      "source-hash-mismatch",
      "source-text-mismatch",
    ]);
    expect(() => createFinding({
      producer: record.producer,
      source: record.source,
      span: { startByte: 0, endByte: 0, sourceText: "" },
      category: record.category,
      reason: record.reason,
    })).toThrow(/cover source text/);
  });
});
