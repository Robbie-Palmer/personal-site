import { z } from "zod";

import { canonicalJson } from "./canonical-json";
import {
  ProducerSchema,
  sha256,
  SourceReferenceSchema,
  Utf8SpanSchema,
  WRITING_EDITOR_SCHEMA_VERSION,
} from "./suggestions";

const FINDING_ID_PATTERN = /^finding:v1:[a-f0-9]{64}$/;

export const FindingIdSchema = z.string().regex(FINDING_ID_PATTERN);

const FindingShapeSchema = z.object({
  schemaVersion: z.literal(WRITING_EDITOR_SCHEMA_VERSION),
  recordType: z.literal("writing-finding"),
  findingId: FindingIdSchema,
  producer: ProducerSchema,
  source: SourceReferenceSchema,
  span: Utf8SpanSchema,
  category: z.string().trim().min(1),
  reason: z.string().trim().min(1),
  confidence: z.number().min(0).max(1).optional(),
}).strict();

export type Finding = z.infer<typeof FindingShapeSchema>;
export const FindingInputSchema = FindingShapeSchema.omit({
  schemaVersion: true,
  recordType: true,
  findingId: true,
});
export type FindingInput = z.input<typeof FindingInputSchema>;

export const FindingSchema = FindingShapeSchema.superRefine((finding, context) => {
  if (finding.span.endByte === finding.span.startByte) {
    context.addIssue({
      code: "custom",
      message: "a finding must cover source text",
      path: ["span"],
    });
  }
  const expected = findingId(finding);
  if (finding.findingId !== expected) {
    context.addIssue({
      code: "custom",
      message: `findingId does not match record identity; expected ${expected}`,
      path: ["findingId"],
    });
  }
});

function findingIdentity(
  finding: Pick<
    Finding,
    "schemaVersion" | "producer" | "source" | "span" | "category"
  >,
): unknown {
  return {
    schemaVersion: finding.schemaVersion,
    producer: {
      id: finding.producer.id,
      version: finding.producer.version,
    },
    source: finding.source,
    span: {
      startByte: finding.span.startByte,
      endByte: finding.span.endByte,
    },
    category: finding.category,
  };
}

export function findingId(
  finding: Pick<
    Finding,
    "schemaVersion" | "producer" | "source" | "span" | "category"
  >,
): string {
  const digest = sha256(canonicalJson(findingIdentity(finding))).slice("sha256:".length);
  return `finding:v1:${digest}`;
}

export function createFinding(input: FindingInput): Finding {
  const parsedInput = FindingInputSchema.parse(input);
  const candidate = {
    schemaVersion: WRITING_EDITOR_SCHEMA_VERSION,
    recordType: "writing-finding" as const,
    findingId: "",
    ...parsedInput,
  };
  candidate.findingId = findingId(candidate);
  return FindingSchema.parse(candidate);
}

export function compareFindings(left: Finding, right: Finding): number {
  return left.span.startByte - right.span.startByte ||
    left.span.endByte - right.span.endByte ||
    compareAscending(left.producer.id, right.producer.id) ||
    compareAscending(left.findingId, right.findingId);
}

export type FindingSourceConflict =
  | { kind: "source-hash-mismatch"; expected: string; actual: string }
  | { kind: "span-out-of-bounds"; findingId: string }
  | { kind: "span-not-on-utf8-boundary"; findingId: string }
  | { kind: "source-text-mismatch"; findingId: string };

export type FindingSourceVerification =
  | { ok: true }
  | { ok: false; conflicts: FindingSourceConflict[] };

export function verifyFindingSource(
  finding: Finding,
  source: string,
): FindingSourceVerification {
  const conflicts: FindingSourceConflict[] = [];
  const actualHash = sha256(source);
  if (actualHash !== finding.source.contentHash) {
    conflicts.push({
      kind: "source-hash-mismatch",
      expected: finding.source.contentHash,
      actual: actualHash,
    });
  }

  const bytes = Buffer.from(source, "utf8");
  const { startByte, endByte, sourceText } = finding.span;
  if (endByte > bytes.byteLength) {
    conflicts.push({ kind: "span-out-of-bounds", findingId: finding.findingId });
  } else if (!isUtf8Boundary(bytes, startByte) || !isUtf8Boundary(bytes, endByte)) {
    conflicts.push({
      kind: "span-not-on-utf8-boundary",
      findingId: finding.findingId,
    });
  } else if (!bytes.subarray(startByte, endByte).equals(Buffer.from(sourceText, "utf8"))) {
    conflicts.push({ kind: "source-text-mismatch", findingId: finding.findingId });
  }

  return conflicts.length === 0 ? { ok: true } : { ok: false, conflicts };
}

function isUtf8Boundary(bytes: Uint8Array, offset: number): boolean {
  const byte = bytes[offset];
  return byte === undefined || (byte & 0xc0) !== 0x80;
}

function compareAscending(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
