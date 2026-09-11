import { createHash } from "node:crypto";

import { z } from "zod";

import { canonicalJson } from "./canonical-json";

export const WRITING_EDITOR_SCHEMA_VERSION = 1 as const;

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;
const SUGGESTION_ID_PATTERN = /^suggestion:v1:[a-f0-9]{64}$/;

export const ContentHashSchema = z.string().regex(SHA256_PATTERN);
export const SuggestionIdSchema = z.string().regex(SUGGESTION_ID_PATTERN);

export const RuleProvenanceSchema = z.object({
  kind: z.literal("rule"),
  ruleId: z.string().trim().min(1),
}).strict();

export const ModelProvenanceSchema = z.object({
  kind: z.literal("model"),
  modelId: z.string().trim().min(1),
  revision: z.string().trim().min(1),
}).strict();

export const ProducerSchema = z.object({
  id: z.string().trim().min(1),
  version: z.string().trim().min(1),
  provenance: z.discriminatedUnion("kind", [
    RuleProvenanceSchema,
    ModelProvenanceSchema,
  ]),
}).strict();

export const SourceReferenceSchema = z.object({
  documentId: z.string().trim().min(1),
  revision: z.string().trim().min(1),
  contentHash: ContentHashSchema,
}).strict();

export const Utf8SpanSchema = z.object({
  startByte: z.number().int().nonnegative(),
  endByte: z.number().int().nonnegative(),
  sourceText: z.string(),
}).strict().superRefine((span, context) => {
  if (span.endByte < span.startByte) {
    context.addIssue({
      code: "custom",
      message: "endByte must be greater than or equal to startByte",
      path: ["endByte"],
    });
  }
  if (Buffer.byteLength(span.sourceText, "utf8") !== span.endByte - span.startByte) {
    context.addIssue({
      code: "custom",
      message: "span byte length must equal the UTF-8 byte length of sourceText",
      path: ["sourceText"],
    });
  }
});

const SuggestionShapeSchema = z.object({
  schemaVersion: z.literal(WRITING_EDITOR_SCHEMA_VERSION),
  recordType: z.literal("writing-suggestion"),
  suggestionId: SuggestionIdSchema,
  producer: ProducerSchema,
  source: SourceReferenceSchema,
  span: Utf8SpanSchema,
  replacement: z.string(),
  category: z.string().trim().min(1),
  reason: z.string().trim().min(1),
  confidence: z.number().min(0).max(1).optional(),
}).strict();

export type Suggestion = z.infer<typeof SuggestionShapeSchema>;
export const SuggestionInputSchema = SuggestionShapeSchema.omit({
  schemaVersion: true,
  recordType: true,
  suggestionId: true,
});
export type SuggestionInput = z.input<typeof SuggestionInputSchema>;

export const SuggestionSchema = SuggestionShapeSchema.superRefine(
  (suggestion, context) => {
    const expected = suggestionId(suggestion);
    if (suggestion.suggestionId !== expected) {
      context.addIssue({
        code: "custom",
        message: `suggestionId does not match record identity; expected ${expected}`,
        path: ["suggestionId"],
      });
    }
  },
);

export function sha256(value: string | Uint8Array): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function sourceReference(
  documentId: string,
  revision: string,
  source: string,
): z.input<typeof SourceReferenceSchema> {
  return {
    documentId,
    revision,
    contentHash: sha256(source),
  };
}

function suggestionIdentity(
  suggestion: Pick<
    Suggestion,
    "schemaVersion" | "producer" | "source" | "span" | "category" | "replacement"
  >,
): unknown {
  return {
    schemaVersion: suggestion.schemaVersion,
    producer: {
      id: suggestion.producer.id,
      version: suggestion.producer.version,
    },
    source: suggestion.source,
    span: {
      startByte: suggestion.span.startByte,
      endByte: suggestion.span.endByte,
    },
    category: suggestion.category,
    replacement: suggestion.replacement,
  };
}

export function suggestionId(
  suggestion: Pick<
    Suggestion,
    "schemaVersion" | "producer" | "source" | "span" | "category" | "replacement"
  >,
): string {
  const digest = sha256(canonicalJson(suggestionIdentity(suggestion))).slice("sha256:".length);
  return `suggestion:v1:${digest}`;
}

export function createSuggestion(input: SuggestionInput): Suggestion {
  const parsedInput = SuggestionInputSchema.parse(input);
  const candidate = {
    schemaVersion: WRITING_EDITOR_SCHEMA_VERSION,
    recordType: "writing-suggestion" as const,
    suggestionId: "",
    ...parsedInput,
  };
  candidate.suggestionId = suggestionId(candidate);
  return SuggestionSchema.parse(candidate);
}

export function compareSuggestions(left: Suggestion, right: Suggestion): number {
  return left.span.startByte - right.span.startByte ||
    left.span.endByte - right.span.endByte ||
    compareStrings(left.producer.id, right.producer.id) ||
    compareStrings(left.suggestionId, right.suggestionId);
}

function compareStrings(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

export type SourceConflict =
  | { kind: "source-hash-mismatch"; expected: string; actual: string }
  | { kind: "span-out-of-bounds"; suggestionId: string }
  | { kind: "span-not-on-utf8-boundary"; suggestionId: string }
  | { kind: "source-text-mismatch"; suggestionId: string };

export type SourceVerification =
  | { ok: true }
  | { ok: false; conflicts: SourceConflict[] };

export function verifySuggestionSource(
  suggestion: Suggestion,
  source: string,
): SourceVerification {
  const conflicts: SourceConflict[] = [];
  const actualHash = sha256(source);
  if (actualHash !== suggestion.source.contentHash) {
    conflicts.push({
      kind: "source-hash-mismatch",
      expected: suggestion.source.contentHash,
      actual: actualHash,
    });
  }

  const bytes = Buffer.from(source, "utf8");
  const { startByte, endByte, sourceText } = suggestion.span;
  if (endByte > bytes.byteLength) {
    conflicts.push({
      kind: "span-out-of-bounds",
      suggestionId: suggestion.suggestionId,
    });
  } else if (!isUtf8Boundary(bytes, startByte) || !isUtf8Boundary(bytes, endByte)) {
    conflicts.push({
      kind: "span-not-on-utf8-boundary",
      suggestionId: suggestion.suggestionId,
    });
  } else if (
    !bytes.subarray(startByte, endByte).equals(Buffer.from(sourceText, "utf8"))
  ) {
    conflicts.push({
      kind: "source-text-mismatch",
      suggestionId: suggestion.suggestionId,
    });
  }

  return conflicts.length === 0 ? { ok: true } : { ok: false, conflicts };
}

function isUtf8Boundary(bytes: Uint8Array, offset: number): boolean {
  const byte = bytes[offset];
  return byte === undefined || (byte & 0xc0) !== 0x80;
}
