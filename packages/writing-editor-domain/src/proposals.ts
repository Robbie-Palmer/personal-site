import { z } from "zod";

import { canonicalJson } from "./canonical-json";
import {
  compareSuggestions,
  sha256,
  type SourceConflict,
  type SourceVerification,
  type Suggestion,
  SuggestionIdSchema,
  SuggestionSchema,
  verifySuggestionSource,
  WRITING_EDITOR_SCHEMA_VERSION,
} from "./suggestions";

const PROPOSAL_ID_PATTERN = /^proposal:v1:[a-f0-9]{64}$/;

export const ProposalIdSchema = z.string().regex(PROPOSAL_ID_PATTERN);

const ProposalShapeSchema = z.object({
  schemaVersion: z.literal(WRITING_EDITOR_SCHEMA_VERSION),
  recordType: z.literal("writing-proposal"),
  proposalId: ProposalIdSchema,
  migratedFromProposalId: ProposalIdSchema.optional(),
  suggestionIds: z.array(SuggestionIdSchema).min(1),
  suggestions: z.array(SuggestionSchema).min(1),
}).strict();

export type Proposal = z.infer<typeof ProposalShapeSchema>;

export const ProposalSchema = ProposalShapeSchema.superRefine(
  (proposal, context) => {
    const expectedSuggestions = [...proposal.suggestions].sort(compareSuggestions);
    const expectedIds = expectedSuggestions.map(({ suggestionId }) => suggestionId);

    if (new Set(expectedIds).size !== expectedIds.length) {
      context.addIssue({
        code: "custom",
        message: "a proposal cannot contain duplicate suggestions",
        path: ["suggestions"],
      });
    }
    if (
      proposal.suggestionIds.length !== expectedIds.length ||
      proposal.suggestionIds.some((id, index) => id !== expectedIds[index])
    ) {
      context.addIssue({
        code: "custom",
        message: "suggestionIds must match suggestions in canonical order",
        path: ["suggestionIds"],
      });
    }
    if (
      proposal.suggestions.some((suggestion, index) =>
        suggestion.suggestionId !== expectedSuggestions[index]?.suggestionId
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "suggestions must use canonical order",
        path: ["suggestions"],
      });
    }

    const [first] = expectedSuggestions;
    if (
      first &&
      expectedSuggestions.some((suggestion) =>
        suggestion.source.documentId !== first.source.documentId ||
        suggestion.source.revision !== first.source.revision ||
        suggestion.source.contentHash !== first.source.contentHash
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "all proposal suggestions must reference the same source revision",
        path: ["suggestions"],
      });
    }

    const expectedProposalId = proposalId(proposal.schemaVersion, expectedIds);
    if (proposal.proposalId !== expectedProposalId) {
      context.addIssue({
        code: "custom",
        message: `proposalId does not match proposal members; expected ${expectedProposalId}`,
        path: ["proposalId"],
      });
    }
    if (proposal.migratedFromProposalId === proposal.proposalId) {
      context.addIssue({
        code: "custom",
        message: "a migrated proposal must reference a different proposal ID",
        path: ["migratedFromProposalId"],
      });
    }
  },
);

export function proposalId(
  schemaVersion: typeof WRITING_EDITOR_SCHEMA_VERSION,
  suggestionIds: string[],
): string {
  const digest = sha256(canonicalJson({ schemaVersion, suggestionIds })).slice(
    "sha256:".length,
  );
  return `proposal:v1:${digest}`;
}

export function createProposal(
  suggestions: Suggestion[],
  options: { migratedFromProposalId?: string } = {},
): Proposal {
  const sorted = suggestions
    .map((suggestion) => SuggestionSchema.parse(suggestion))
    .sort(compareSuggestions);
  const suggestionIds = sorted.map(({ suggestionId }) => suggestionId);
  return ProposalSchema.parse({
    schemaVersion: WRITING_EDITOR_SCHEMA_VERSION,
    recordType: "writing-proposal",
    proposalId: proposalId(WRITING_EDITOR_SCHEMA_VERSION, suggestionIds),
    ...options,
    suggestionIds,
    suggestions: sorted,
  });
}

function conflictKey(conflict: SourceConflict): string {
  if (conflict.kind === "source-hash-mismatch") {
    return `${conflict.kind}:${conflict.expected}:${conflict.actual}`;
  }
  return `${conflict.kind}:${conflict.suggestionId}`;
}

export function verifyProposalSource(
  proposal: Proposal,
  source: string,
): SourceVerification {
  const conflicts = proposal.suggestions.flatMap((suggestion) => {
    const verification = verifySuggestionSource(suggestion, source);
    return verification.ok ? [] : verification.conflicts;
  });
  if (conflicts.length === 0) return { ok: true };

  const unique = new Map(
    conflicts.map((conflict) => [conflictKey(conflict), conflict]),
  );
  return { ok: false, conflicts: [...unique.values()] };
}
