import { z } from "zod";

import { ProposalIdSchema, ProposalSchema } from "./proposals";
import { WRITING_EDITOR_SCHEMA_VERSION } from "./suggestions";

const DecisionBaseSchema = z.object({
  schemaVersion: z.literal(WRITING_EDITOR_SCHEMA_VERSION),
  recordType: z.literal("writing-decision"),
  proposalId: ProposalIdSchema,
  proposal: ProposalSchema,
});

export const AcceptedDecisionSchema = DecisionBaseSchema.extend({
  outcome: z.literal("accepted"),
}).strict();

export const RejectedDecisionSchema = DecisionBaseSchema.extend({
  outcome: z.literal("rejected"),
}).strict();

export const ChangedDecisionSchema = DecisionBaseSchema.extend({
  outcome: z.literal("changed"),
  replacement: z.string(),
}).strict();

export const DecisionSchema = z
  .discriminatedUnion("outcome", [
    AcceptedDecisionSchema,
    RejectedDecisionSchema,
    ChangedDecisionSchema,
  ])
  .superRefine((decision, context) => {
    if (decision.proposalId !== decision.proposal.proposalId) {
      context.addIssue({
        code: "custom",
        message: "proposalId must match the embedded proposal",
        path: ["proposalId"],
      });
    }
  });

export type Decision = z.infer<typeof DecisionSchema>;
export type DecisionOutcome = Decision["outcome"];

export function createDecision(
  proposal: z.input<typeof ProposalSchema>,
  outcome: "accepted" | "rejected",
): Decision;
export function createDecision(
  proposal: z.input<typeof ProposalSchema>,
  outcome: "changed",
  replacement: string,
): Decision;
export function createDecision(
  proposal: z.input<typeof ProposalSchema>,
  outcome: DecisionOutcome,
  replacement?: string,
): Decision {
  const parsedProposal = ProposalSchema.parse(proposal);
  const candidate = {
    schemaVersion: WRITING_EDITOR_SCHEMA_VERSION,
    recordType: "writing-decision" as const,
    proposalId: parsedProposal.proposalId,
    proposal: parsedProposal,
    outcome,
    ...(outcome === "changed" ? { replacement } : {}),
  };
  return DecisionSchema.parse(candidate);
}
