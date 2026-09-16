import { createHash, randomUUID } from "node:crypto";
import { initTRPC } from "@trpc/server";
import { getCliContext, type TrpcCliMeta } from "trpc-cli";
import { z } from "zod";
import { WorkGraphClient, type Fetch } from "./client.js";
import { resolveClientConfig } from "./config.js";
import { usageError } from "./errors.js";
import {
  zCreateAttentionRequestBody,
  zCreateAttentionRequestHeaders,
  zCreateAttentionResolutionBody,
  zCreateAttentionResolutionHeaders,
  zCreateAttentionResolutionPath,
  zCreateDependencyBody,
  zCreateDependencyHeaders,
  zCreateLeaseBody,
  zCreateKnowledgeScopeRelationshipBody,
  zCreateKnowledgeScopeRelationshipHeaders,
  zCreateLeaseRenewalBody,
  zCreateLeaseRenewalPath,
  zCreatePostReleaseWorkItemNoteBody,
  zCreateWorkItemBody,
  zCreateWorkItemCancellationBody,
  zCreateWorkItemDecompositionBody,
  zCreateWorkItemDecompositionHeaders,
  zCreateWorkItemNoteBody,
  zCreateWorkItemNoteHeaders,
  zCreateWorkItemReleaseBody,
  zGetKnowledgeScopePath,
  zGetWorkItemPath,
  zListAttentionRequestsQuery,
  zListKnowledgeScopeRelationshipsQuery,
  zListKnowledgeScopesQuery,
  zListWorkItemDependenciesPath,
  zListWorkItemDependenciesQuery,
  zListWorkItemEventsPath,
  zListWorkItemEventsQuery,
  zListWorkItemLeasesPath,
  zListWorkItemLeasesQuery,
  zListWorkItemNotesPath,
  zListWorkItemNotesQuery,
  zListWorkItemsQuery,
  zPutKnowledgeScopeBody,
  zPutKnowledgeScopeHeaders,
} from "./generated/client/zod.gen.js";

export type UuidFactory = () => string;

export interface CommandContext {
  environment: NodeJS.ProcessEnv;
  fetch?: Fetch;
  makeUuid: UuidFactory;
}

const mutationUuid = (
  context: CommandContext,
  idempotencyKey: string | undefined,
  role: string,
): string => {
  if (idempotencyKey === undefined) return context.makeUuid();

  const bytes = createHash("sha256")
    .update("work-graph-cli\0")
    .update(role)
    .update("\0")
    .update(idempotencyKey)
    .digest()
    .subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x80;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const globalOptionsSchema = z.object({
  apiUrl: z
    .string()
    .optional()
    .describe("API base URL (or WORK_GRAPH_API_URL)"),
  cfAccessAllowedOrigin: z
    .array(z.string())
    .default([])
    .describe("Exact origin trusted for Access headers; repeatable"),
});

const positional = <Schema extends z.ZodType>(
  schema: Schema,
  description: string,
): Schema => schema.describe(description).meta({ positional: true }) as Schema;

const described = <Schema extends z.ZodType>(
  schema: Schema,
  description: string,
): Schema => schema.describe(description) as Schema;

const optional = <Schema extends z.ZodType>(
  schema: Schema,
  description: string,
) => described(schema.optional(), description);

const idempotencyKey = described(
  zCreateWorkItemNoteHeaders.shape["idempotency-key"],
  "Client-generated UUID used to replay a mutation safely",
);

const leaseDuration = described(
  zCreateLeaseBody.shape.leaseDurationSeconds.default(900),
  "Lease duration in seconds (default: 900)",
);

const epoch = described(
  zCreateLeaseRenewalBody.shape.epoch,
  "Current lease fencing epoch",
);

const jsonArray = <Schema extends z.ZodArray>(
  schema: Schema,
  description: string,
) =>
  z
    .string()
    .describe(description)
    .transform((value, context) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(value);
      } catch {
        context.addIssue({ code: "custom", message: "must be valid JSON" });
        return z.NEVER;
      }
      const result = schema.safeParse(parsed);
      if (!result.success) {
        for (const issue of result.error.issues) {
          context.addIssue({
            code: "custom",
            message: issue.message,
            path: [...issue.path],
          });
        }
        return z.NEVER;
      }
      return result.data;
    });

const resolveClient = (context: CommandContext): WorkGraphClient => {
  const rawOptions = getCliContext()?.program.opts() ?? {};
  const parsed = globalOptionsSchema.safeParse(rawOptions);
  if (!parsed.success) throw usageError(z.prettifyError(parsed.error));

  const config = resolveClientConfig(
    {
      apiUrl: parsed.data.apiUrl,
      accessAllowedOrigins: parsed.data.cfAccessAllowedOrigin,
    },
    context.environment,
  );
  return new WorkGraphClient(config, context.fetch);
};

const t = initTRPC
  .context<CommandContext>()
  .meta<TrpcCliMeta>()
  .create();
const command = t.procedure;

const createInput = z.object({
  id: positional(zCreateWorkItemBody.shape.id, "Work-item ID"),
  title: described(zCreateWorkItemBody.shape.title, "Work-item title"),
  parentId: optional(
    zCreateWorkItemBody.shape.parentId.unwrap().unwrap(),
    "Parent work-item ID",
  ),
  idempotencyKey,
});

const scopeListInput = z.object({
  kind: optional(
    zListKnowledgeScopesQuery.shape.kind.unwrap(),
    "Knowledge-scope kind",
  ),
  limit: optional(
    zListKnowledgeScopesQuery.shape.limit.unwrap().unwrap(),
    "Maximum number of knowledge scopes",
  ),
  cursor: optional(
    zListKnowledgeScopesQuery.shape.cursor.unwrap(),
    "Pagination cursor",
  ),
});

const scopePutInput = z.object({
  knowledgeScopeId: positional(
    zGetKnowledgeScopePath.shape.knowledgeScopeId,
    "Stable knowledge-scope source key",
  ),
  kind: described(zPutKnowledgeScopeBody.shape.kind, "Knowledge-scope kind"),
  title: described(zPutKnowledgeScopeBody.shape.title, "Source title snapshot"),
  canonicalUrl: described(
    zPutKnowledgeScopeBody.shape.canonicalUrl,
    "Canonical HTML URL",
  ),
  markdownUrl: described(
    zPutKnowledgeScopeBody.shape.markdownUrl,
    "Canonical Markdown URL",
  ),
  sourceRevision: optional(
    zPutKnowledgeScopeBody.shape.sourceRevision.unwrap().unwrap(),
    "Source revision",
  ),
  rank: optional(
    zPutKnowledgeScopeBody.shape.rank.unwrap().unwrap(),
    "Local positive rank",
  ),
  priorityWeight: optional(
    zPutKnowledgeScopeBody.shape.priorityWeight.unwrap().unwrap(),
    "Local priority weight",
  ),
  idempotencyKey: described(
    zPutKnowledgeScopeHeaders.shape["idempotency-key"],
    "Client-generated UUID used to replay a mutation safely",
  ),
});

const scopeRelationshipInput = z.object({
  parentKnowledgeScopeId: positional(
    zCreateKnowledgeScopeRelationshipBody.shape.parentKnowledgeScopeId,
    "Parent knowledge-scope source key",
  ),
  childKnowledgeScopeId: positional(
    zCreateKnowledgeScopeRelationshipBody.shape.childKnowledgeScopeId,
    "Child knowledge-scope source key",
  ),
  idempotencyKey: described(
    zCreateKnowledgeScopeRelationshipHeaders.shape["idempotency-key"],
    "Client-generated UUID used to replay a mutation safely",
  ),
});

const scopeRelationshipListInput = z.object({
  limit: optional(
    zListKnowledgeScopeRelationshipsQuery.shape.limit.unwrap().unwrap(),
    "Maximum number of knowledge-scope relationships",
  ),
  cursor: optional(
    zListKnowledgeScopeRelationshipsQuery.shape.cursor.unwrap(),
    "Opaque relationship cursor",
  ),
});

const dependencyInput = z.object({
  dependentWorkItemId: positional(
    zCreateDependencyBody.shape.dependentWorkItemId,
    "Dependent work-item ID",
  ),
  blockerWorkItemId: positional(
    zCreateDependencyBody.shape.blockerWorkItemId,
    "Blocker work-item ID",
  ),
  idempotencyKey: described(
    zCreateDependencyHeaders.shape["idempotency-key"],
    "Client-generated UUID used to replay a mutation safely",
  ),
});

const queueInput = z
  .object({
    stage: optional(zListWorkItemsQuery.shape.stage.unwrap(), "Stage to list"),
    all: z
      .boolean()
      .optional()
      .describe("List all stages instead of the ready queue"),
    limit: optional(
      zListWorkItemsQuery.shape.limit.unwrap().unwrap(),
      "Maximum number of work items",
    ),
    cursor: optional(
      zListWorkItemsQuery.shape.cursor.unwrap(),
      "Pagination cursor",
    ),
  })
  .refine((input) => !(input.all && input.stage), {
    message: "--all and --stage cannot be used together",
    path: ["all"],
  });

const claimInput = z.object({
  workItemId: positional(
    optional(zCreateLeaseBody.shape.workItemId.unwrap(), "Work-item ID"),
    "Work-item ID",
  ),
  workerId: optional(zCreateLeaseBody.shape.workerId, "Worker identity"),
  leaseDurationSeconds: leaseDuration,
});

const noteInput = z.object({
  workItemId: positional(zGetWorkItemPath.shape.workItemId, "Work-item ID"),
  id: optional(
    zCreateWorkItemNoteBody.shape.id,
    "Note UUID (generated by default)",
  ),
  leaseId: described(zCreateWorkItemNoteBody.shape.leaseId, "Lease UUID"),
  epoch,
  content: described(zCreateWorkItemNoteBody.shape.content, "Note text"),
  idempotencyKey,
});

const commentInput = z.object({
  workItemId: positional(zGetWorkItemPath.shape.workItemId, "Work-item ID"),
  id: optional(
    zCreatePostReleaseWorkItemNoteBody.shape.id,
    "Note UUID (generated by default)",
  ),
  author: optional(
    zCreatePostReleaseWorkItemNoteBody.shape.author,
    "Author provenance (or WORK_GRAPH_WORKER_ID)",
  ),
  content: described(
    zCreatePostReleaseWorkItemNoteBody.shape.content,
    "Post-release discussion text",
  ),
  idempotencyKey,
});

const renewInput = z.object({
  leaseId: positional(zCreateLeaseRenewalPath.shape.leaseId, "Lease UUID"),
  epoch,
  leaseDurationSeconds: leaseDuration,
});

const decompositionChildren = zCreateWorkItemDecompositionBody.shape.children;
const decompositionDependencies =
  zCreateWorkItemDecompositionBody.shape.dependencies.unwrap();
const decompositionClaim = zCreateWorkItemDecompositionBody.shape.claim.unwrap();

const decomposeInput = z
  .object({
    workItemId: positional(zGetWorkItemPath.shape.workItemId, "Work-item ID"),
    leaseId: described(
      zCreateWorkItemDecompositionBody.shape.leaseId,
      "Lease UUID",
    ),
    epoch,
    childrenJson: jsonArray(
      decompositionChildren,
      "Contract-shaped JSON array of child work items",
    ),
    dependenciesJson: jsonArray(
      decompositionDependencies,
      "Contract-shaped JSON array of dependencies",
    ).optional(),
    claimWorkItemId: optional(
      decompositionClaim.shape.workItemId,
      "Child work-item ID to claim atomically",
    ),
    claimLeaseId: optional(
      decompositionClaim.shape.leaseId,
      "UUID for the child lease (generated by default)",
    ),
    claimLeaseDurationSeconds: optional(
      decompositionClaim.shape.leaseDurationSeconds,
      "Child lease duration in seconds (default: 900)",
    ),
    idempotencyKey: described(
      zCreateWorkItemDecompositionHeaders.shape["idempotency-key"],
      "Client-generated UUID used to replay a mutation safely",
    ),
  })
  .superRefine((input, context) => {
    if (!input.claimWorkItemId && input.claimLeaseId) {
      context.addIssue({
        code: "custom",
        message: "--claim-lease-id requires --claim-work-item-id",
        path: ["claimLeaseId"],
      });
    }
    if (!input.claimWorkItemId && input.claimLeaseDurationSeconds) {
      context.addIssue({
        code: "custom",
        message:
          "--claim-lease-duration-seconds requires --claim-work-item-id",
        path: ["claimLeaseDurationSeconds"],
      });
    }
  });

const attentionListInput = z.object({
  state: optional(
    zListAttentionRequestsQuery.shape.state.unwrap().unwrap(),
    "Resolution state (default: unresolved)",
  ),
  blocking: optional(
    zListAttentionRequestsQuery.shape.blocking.unwrap(),
    "Filter by blocking status",
  ),
  limit: optional(
    zListAttentionRequestsQuery.shape.limit.unwrap().unwrap(),
    "Maximum number of attention requests",
  ),
  cursor: optional(
    zListAttentionRequestsQuery.shape.cursor.unwrap(),
    "Pagination cursor UUID",
  ),
});

const attentionRequestInput = z.object({
  workItemId: positional(
    zCreateAttentionRequestBody.shape.workItemId,
    "Work-item ID",
  ),
  id: optional(
    zCreateAttentionRequestBody.shape.id,
    "Attention-request UUID (generated by default)",
  ),
  leaseId: described(zCreateAttentionRequestBody.shape.leaseId, "Lease UUID"),
  epoch,
  kind: described(zCreateAttentionRequestBody.shape.kind, "Request kind"),
  question: described(
    zCreateAttentionRequestBody.shape.question,
    "Question requiring attention",
  ),
  note: optional(zCreateAttentionRequestBody.shape.note.unwrap(), "Context note"),
  nonBlocking: z
    .boolean()
    .optional()
    .describe("Mark the attention request as non-blocking"),
  idempotencyKey: described(
    zCreateAttentionRequestHeaders.shape["idempotency-key"],
    "Client-generated UUID used to replay a mutation safely",
  ),
});

const attentionResolveInput = z.object({
  attentionRequestId: positional(
    zCreateAttentionResolutionPath.shape.attentionRequestId,
    "Attention-request UUID",
  ),
  id: optional(
    zCreateAttentionResolutionBody.shape.id,
    "Resolution UUID (generated by default)",
  ),
  resolution: described(
    zCreateAttentionResolutionBody.shape.resolution,
    "Resolution text",
  ),
  idempotencyKey: described(
    zCreateAttentionResolutionHeaders.shape["idempotency-key"],
    "Client-generated UUID used to replay a mutation safely",
  ),
});

const terminationInput = z.object({
  workItemId: positional(zGetWorkItemPath.shape.workItemId, "Work-item ID"),
  leaseId: described(zCreateWorkItemReleaseBody.shape.leaseId, "Lease UUID"),
  epoch,
});

const releaseInput = terminationInput.extend({
  mergeEvidence: described(
    zCreateWorkItemReleaseBody.shape.mergeEvidence,
    "Merged pull request, commit, or equivalent evidence",
  ),
  deploymentEvidence: described(
    zCreateWorkItemReleaseBody.shape.deploymentEvidence,
    "Production deployment and verification evidence",
  ),
});

const metadataNotesInput = z.object({
  workItemId: positional(
    zListWorkItemNotesPath.shape.workItemId,
    "Work-item ID",
  ),
  limit: optional(
    zListWorkItemNotesQuery.shape.limit.unwrap().unwrap(),
    "Maximum number of notes",
  ),
  cursor: optional(
    zListWorkItemNotesQuery.shape.cursor.unwrap(),
    "Pagination cursor UUID",
  ),
});

const metadataEventsInput = z.object({
  workItemId: positional(
    zListWorkItemEventsPath.shape.workItemId,
    "Work-item ID",
  ),
  type: optional(
    zListWorkItemEventsQuery.shape.type.unwrap(),
    "Event type",
  ),
  limit: optional(
    zListWorkItemEventsQuery.shape.limit.unwrap().unwrap(),
    "Maximum number of events",
  ),
  afterSequence: optional(
    zListWorkItemEventsQuery.shape.afterSequence.unwrap(),
    "Continue after this event sequence",
  ),
});

const metadataDependenciesInput = z.object({
  workItemId: positional(
    zListWorkItemDependenciesPath.shape.workItemId,
    "Work-item ID",
  ),
  limit: optional(
    zListWorkItemDependenciesQuery.shape.limit.unwrap().unwrap(),
    "Maximum number of dependency edges",
  ),
  cursor: optional(
    zListWorkItemDependenciesQuery.shape.cursor.unwrap(),
    "Opaque dependency cursor",
  ),
});

const metadataLeasesInput = z.object({
  workItemId: positional(
    zListWorkItemLeasesPath.shape.workItemId,
    "Work-item ID",
  ),
  limit: optional(
    zListWorkItemLeasesQuery.shape.limit.unwrap().unwrap(),
    "Maximum number of leases",
  ),
  afterEpoch: optional(
    zListWorkItemLeasesQuery.shape.afterEpoch.unwrap(),
    "Continue after this lease epoch",
  ),
});

const metadataAttentionInput = z.object({
  workItemId: positional(
    zListAttentionRequestsQuery.shape.workItemId.unwrap(),
    "Work-item ID",
  ),
  limit: optional(
    zListAttentionRequestsQuery.shape.limit.unwrap().unwrap(),
    "Maximum number of attention requests",
  ),
  cursor: optional(
    zListAttentionRequestsQuery.shape.cursor.unwrap(),
    "Pagination cursor UUID",
  ),
});

export const workGraphRouter = t.router({
  metadata: t.router({
    notes: command
      .meta({ description: "List work-item notes" })
      .input(metadataNotesInput)
      .query(({ ctx, input }) =>
        resolveClient(ctx).listWorkItemNotes(input.workItemId, {
          ...(input.limit === undefined ? {} : { limit: input.limit }),
          ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
        }),
      ),
    events: command
      .meta({ description: "List immutable work-item events" })
      .input(metadataEventsInput)
      .query(({ ctx, input }) =>
        resolveClient(ctx).listWorkItemEvents(input.workItemId, {
          ...(input.type === undefined ? {} : { type: input.type }),
          ...(input.limit === undefined ? {} : { limit: input.limit }),
          ...(input.afterSequence === undefined
            ? {}
            : { afterSequence: input.afterSequence }),
        }),
      ),
    dependencies: command
      .meta({ description: "List dependency edges involving a work item" })
      .input(metadataDependenciesInput)
      .query(({ ctx, input }) =>
        resolveClient(ctx).listWorkItemDependencies(input.workItemId, {
          ...(input.limit === undefined ? {} : { limit: input.limit }),
          ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
        }),
      ),
    decompositions: command
      .meta({ description: "List work-item decomposition history" })
      .input(metadataEventsInput.omit({ type: true }))
      .query(({ ctx, input }) =>
        resolveClient(ctx).listWorkItemEvents(input.workItemId, {
          type: "work_item.decomposed",
          ...(input.limit === undefined ? {} : { limit: input.limit }),
          ...(input.afterSequence === undefined
            ? {}
            : { afterSequence: input.afterSequence }),
        }),
      ),
    leases: command
      .meta({ description: "List work-item lease history" })
      .input(metadataLeasesInput)
      .query(({ ctx, input }) =>
        resolveClient(ctx).listWorkItemLeases(input.workItemId, {
          ...(input.limit === undefined ? {} : { limit: input.limit }),
          ...(input.afterEpoch === undefined
            ? {}
            : { afterEpoch: input.afterEpoch }),
        }),
      ),
    attention: command
      .meta({ description: "List work-item attention history" })
      .input(metadataAttentionInput)
      .query(({ ctx, input }) =>
        resolveClient(ctx).listAttention({
          workItemId: input.workItemId,
          state: "all",
          ...(input.limit === undefined ? {} : { limit: input.limit }),
          ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
        }),
      ),
    cancellations: command
      .meta({ description: "List work-item cancellation history" })
      .input(metadataEventsInput.omit({ type: true }))
      .query(({ ctx, input }) =>
        resolveClient(ctx).listWorkItemEvents(input.workItemId, {
          type: "work_item.lifecycle_changed",
          lifecycle: "cancelled",
          ...(input.limit === undefined ? {} : { limit: input.limit }),
          ...(input.afterSequence === undefined
            ? {}
            : { afterSequence: input.afterSequence }),
        }),
      ),
    releases: command
      .meta({ description: "List work-item release evidence" })
      .input(metadataEventsInput.omit({ type: true }))
      .query(({ ctx, input }) =>
        resolveClient(ctx).listWorkItemEvents(input.workItemId, {
          type: "work_item.lifecycle_changed",
          lifecycle: "released",
          ...(input.limit === undefined ? {} : { limit: input.limit }),
          ...(input.afterSequence === undefined
            ? {}
            : { afterSequence: input.afterSequence }),
        }),
      ),
  }),
  dependency: t.router({
    add: command
      .meta({ description: "Add a work-item dependency" })
      .input(dependencyInput)
      .mutation(({ ctx, input }) =>
        resolveClient(ctx).addDependency(
          {
            dependentWorkItemId: input.dependentWorkItemId,
            blockerWorkItemId: input.blockerWorkItemId,
          },
          input.idempotencyKey,
        ),
      ),
    remove: command
      .meta({ description: "Remove a work-item dependency" })
      .input(dependencyInput)
      .mutation(({ ctx, input }) =>
        resolveClient(ctx).removeDependency(
          {
            dependentWorkItemId: input.dependentWorkItemId,
            blockerWorkItemId: input.blockerWorkItemId,
          },
          input.idempotencyKey,
        ),
      ),
  }),
  scope: t.router({
    list: command
      .meta({ description: "List knowledge-scope mirrors" })
      .input(scopeListInput)
      .query(({ ctx, input }) =>
        resolveClient(ctx).listKnowledgeScopes({
          ...(input.kind === undefined ? {} : { kind: input.kind }),
          ...(input.limit === undefined ? {} : { limit: input.limit }),
          ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
        }),
      ),
    show: command
      .meta({ description: "Show a knowledge-scope mirror" })
      .input(
        z.object({
          knowledgeScopeId: positional(
            zGetKnowledgeScopePath.shape.knowledgeScopeId,
            "Stable knowledge-scope source key",
          ),
        }),
      )
      .query(({ ctx, input }) =>
        resolveClient(ctx).getKnowledgeScope(input.knowledgeScopeId),
      ),
    put: command
      .meta({ description: "Create or replace a knowledge-scope mirror" })
      .input(scopePutInput)
      .mutation(({ ctx, input }) =>
        resolveClient(ctx).putKnowledgeScope(
          input.knowledgeScopeId,
          {
            kind: input.kind,
            title: input.title,
            canonicalUrl: input.canonicalUrl,
            markdownUrl: input.markdownUrl,
            ...(input.sourceRevision === undefined
              ? {}
              : { sourceRevision: input.sourceRevision }),
            ...(input.rank === undefined ? {} : { rank: input.rank }),
            ...(input.priorityWeight === undefined
              ? {}
              : { priorityWeight: input.priorityWeight }),
          },
          input.idempotencyKey,
        ),
      ),
    links: command
      .meta({ description: "List knowledge-scope relationships" })
      .input(scopeRelationshipListInput)
      .query(({ ctx, input }) =>
        resolveClient(ctx).listKnowledgeScopeRelationships({
          ...(input.limit === undefined ? {} : { limit: input.limit }),
          ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
        }),
      ),
    link: command
      .meta({ description: "Add a knowledge-scope relationship" })
      .input(scopeRelationshipInput)
      .mutation(({ ctx, input }) =>
        resolveClient(ctx).addKnowledgeScopeRelationship(
          {
            parentKnowledgeScopeId: input.parentKnowledgeScopeId,
            childKnowledgeScopeId: input.childKnowledgeScopeId,
          },
          input.idempotencyKey,
        ),
      ),
    unlink: command
      .meta({ description: "Remove a knowledge-scope relationship" })
      .input(scopeRelationshipInput)
      .mutation(({ ctx, input }) =>
        resolveClient(ctx).removeKnowledgeScopeRelationship(
          {
            parentKnowledgeScopeId: input.parentKnowledgeScopeId,
            childKnowledgeScopeId: input.childKnowledgeScopeId,
          },
          input.idempotencyKey,
        ),
      ),
  }),
  create: command
    .meta({ description: "Create a work item" })
    .input(createInput)
    .mutation(({ ctx, input }) =>
      resolveClient(ctx).createWorkItem(
        {
          id: input.id,
          title: input.title,
          ...(input.parentId === undefined ? {} : { parentId: input.parentId }),
        },
        input.idempotencyKey,
      ),
    ),
  queue: command
    .meta({ description: "List queued work items" })
    .input(queueInput)
    .query(({ ctx, input }) =>
      resolveClient(ctx).listWorkItems({
        ...(input.all ? {} : { stage: input.stage ?? "ready" }),
        ...(input.limit === undefined ? {} : { limit: input.limit }),
        ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
      }),
    ),
  claim: command
    .meta({ description: "Claim the next ready work item or a specified item" })
    .input(claimInput)
    .mutation(({ ctx, input }) => {
      const workerId = input.workerId ?? ctx.environment.WORK_GRAPH_WORKER_ID;
      if (!workerId) {
        throw usageError("Set WORK_GRAPH_WORKER_ID or pass --worker-id.");
      }
      return resolveClient(ctx).claim({
        workerId,
        leaseDurationSeconds: input.leaseDurationSeconds,
        ...(input.workItemId === undefined
          ? {}
          : { workItemId: input.workItemId }),
      });
    }),
  show: command
    .meta({ description: "Show a work item" })
    .input(
      z.object({
        workItemId: positional(
          zGetWorkItemPath.shape.workItemId,
          "Work-item ID",
        ),
      }),
    )
    .query(({ ctx, input }) => resolveClient(ctx).getWorkItem(input.workItemId)),
  note: command
    .meta({ description: "Record a lease-fenced note on a work item" })
    .input(noteInput)
    .mutation(({ ctx, input }) =>
      resolveClient(ctx).createNote(
        input.workItemId,
        {
          id: input.id ?? mutationUuid(ctx, input.idempotencyKey, "note"),
          leaseId: input.leaseId,
          epoch: input.epoch,
          content: input.content,
        },
        input.idempotencyKey,
      ),
    ),
  comment: command
    .meta({ description: "Append a note to released work" })
    .input(commentInput)
    .mutation(({ ctx, input }) => {
      const author = input.author ?? ctx.environment.WORK_GRAPH_WORKER_ID;
      if (!author) {
        throw usageError(
          "Set WORK_GRAPH_WORKER_ID or pass --author for provenance.",
        );
      }
      return resolveClient(ctx).createPostReleaseNote(
        input.workItemId,
        {
          id:
            input.id ??
            mutationUuid(ctx, input.idempotencyKey, "post-release-note"),
          author,
          content: input.content,
        },
        input.idempotencyKey,
      );
    }),
  renew: command
    .meta({ description: "Renew a lease" })
    .input(renewInput)
    .mutation(({ ctx, input }) =>
      resolveClient(ctx).renew(input.leaseId, {
        epoch: input.epoch,
        leaseDurationSeconds: input.leaseDurationSeconds,
      }),
    ),
  decompose: command
    .meta({ description: "Decompose a work item into children" })
    .input(decomposeInput)
    .mutation(({ ctx, input }) =>
      resolveClient(ctx).decompose(
        input.workItemId,
        {
          leaseId: input.leaseId,
          epoch: input.epoch,
          children: input.childrenJson,
          ...(input.dependenciesJson === undefined
            ? {}
            : { dependencies: input.dependenciesJson }),
          ...(input.claimWorkItemId === undefined
            ? {}
            : {
                claim: {
                  workItemId: input.claimWorkItemId,
                  leaseId:
                    input.claimLeaseId ??
                    mutationUuid(
                      ctx,
                      input.idempotencyKey,
                      "decomposition-claim",
                    ),
                  leaseDurationSeconds:
                    input.claimLeaseDurationSeconds ?? 900,
                },
              }),
        },
        input.idempotencyKey,
      ),
    ),
  attention: t.router({
    list: command
      .meta({ description: "List attention requests" })
      .input(attentionListInput)
      .query(({ ctx, input }) =>
        resolveClient(ctx).listAttention({
          state: input.state ?? "unresolved",
          ...(input.blocking === undefined
            ? {}
            : { blocking: input.blocking }),
          ...(input.limit === undefined ? {} : { limit: input.limit }),
          ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
        }),
      ),
    request: command
      .meta({ description: "Request human or agent attention" })
      .input(attentionRequestInput)
      .mutation(({ ctx, input }) =>
        resolveClient(ctx).requestAttention(
          {
            id:
              input.id ??
              mutationUuid(ctx, input.idempotencyKey, "attention-request"),
            workItemId: input.workItemId,
            leaseId: input.leaseId,
            epoch: input.epoch,
            kind: input.kind,
            question: input.question,
            ...(input.note === undefined ? {} : { note: input.note }),
            blocking: input.nonBlocking !== true,
          },
          input.idempotencyKey,
        ),
      ),
    resolve: command
      .meta({ description: "Resolve an attention request" })
      .input(attentionResolveInput)
      .mutation(({ ctx, input }) =>
        resolveClient(ctx).resolveAttention(
          input.attentionRequestId,
          {
            id:
              input.id ??
              mutationUuid(ctx, input.idempotencyKey, "attention-resolution"),
            resolution: input.resolution,
          },
          input.idempotencyKey,
        ),
      ),
  }),
  release: command
    .meta({
      description: "Complete claimed work after it is merged and deployed",
    })
    .input(releaseInput)
    .mutation(({ ctx, input }) =>
      resolveClient(ctx).release(input.workItemId, {
        leaseId: input.leaseId,
        epoch: input.epoch,
        mergeEvidence: input.mergeEvidence,
        deploymentEvidence: input.deploymentEvidence,
      }),
    ),
  cancel: command
    .meta({ description: "Cancel claimed work" })
    .input(
      terminationInput.extend({
        leaseId: described(
          zCreateWorkItemCancellationBody.shape.leaseId,
          "Lease UUID",
        ),
      }),
    )
    .mutation(({ ctx, input }) =>
      resolveClient(ctx).cancel(input.workItemId, {
        leaseId: input.leaseId,
        epoch: input.epoch,
      }),
    ),
});

export const createCommandContext = (
  context: Partial<CommandContext> = {},
): CommandContext => ({
  environment: context.environment ?? process.env,
  fetch: context.fetch,
  makeUuid: context.makeUuid ?? randomUUID,
});
