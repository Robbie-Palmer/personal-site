import {
  createRoute,
  OpenAPIHono,
  type Hook,
} from "@hono/zod-openapi";
import type { Env } from "hono";
import type {
  AttentionRequestReadModel,
  ClaimWorkItemInput,
  CreateAttentionRequestInput,
  CreateAttentionRequestResult,
  CreateNoteInput,
  IdempotentMutationOptions,
  ResolveAttentionRequestInput,
  ResolveAttentionRequestResult,
  RenewLeaseInput,
  StoredAttentionRequest,
  StoredAttentionResolution,
  StoredLease,
  StoredNote,
  TerminateClaimedWorkItemInput,
  WorkItemReadModel,
} from "work-graph-db";
import {
  LEASE_OUTCOMES,
  WORK_ITEM_LIFECYCLES,
  WORK_STAGES,
  WorkGraphError,
  type NewWorkItemInput,
  type WorkItem,
  type WorkItemDependency,
} from "work-graph-domain";
import { z } from "zod";

const MAX_IDENTIFIER_LENGTH = 200;
const MAX_TITLE_LENGTH = 10_000;
const MAX_LEASE_DURATION_SECONDS = 86_400;
const DEFAULT_LIST_LIMIT = 50;

const identifierSchema = z.string().trim().min(1).max(MAX_IDENTIFIER_LENGTH);
const leaseIdSchema = z.uuid().max(36);
const leaseEpochSchema = z
  .number()
  .int()
  .min(1)
  .max(2_147_483_647)
  .openapi({ format: "int32" });
const leaseDurationSchema = z
  .number()
  .int()
  .min(1)
  .max(MAX_LEASE_DURATION_SECONDS)
  .openapi({ format: "int32" });
const timestampSchema = z.iso.datetime().max(30);
const idempotencyHeadersSchema = z.object({
  "idempotency-key": z.uuid().max(36).optional().openapi({
    description:
      "Client-generated mutation ID. Reusing it with the same request replays the committed effect. Reusing it for different input returns a conflict.",
  }),
});

const errorSchema = z
  .object({
    error: z.object({
      code: z.string().min(1).max(100),
      message: z.string().min(1).max(500),
      details: z
        .array(
          z.object({
            path: z.array(z.union([z.string().max(200), z.number()])).max(20),
            message: z.string().max(500),
          }),
        )
        .max(100)
        .optional(),
    }),
  })
  .openapi("Error");

const leaseSchema = z
  .object({
    id: leaseIdSchema,
    workItemId: identifierSchema,
    workerId: identifierSchema,
    epoch: leaseEpochSchema,
    acquiredAt: timestampSchema,
    expiresAt: timestampSchema,
    endedAt: z.union([timestampSchema, z.null()]),
    outcome: z.union([z.enum(LEASE_OUTCOMES), z.null()]),
  })
  .openapi("Lease");

const workItemSchema = z
  .object({
    id: identifierSchema,
    title: z.string().min(1).max(MAX_TITLE_LENGTH),
    lifecycle: z.enum(WORK_ITEM_LIFECYCLES),
    parentId: z.union([identifierSchema, z.null()]),
    stage: z.enum(WORK_STAGES),
    currentLease: z.union([leaseSchema, z.null()]),
  })
  .openapi("WorkItem");

const workItemListSchema = z
  .object({
    items: z.array(workItemSchema).max(100),
    nextCursor: z.union([identifierSchema, z.null()]),
  })
  .openapi("WorkItemList");
const workItemDependencySchema = z
  .object({
    dependentWorkItemId: identifierSchema,
    blockerWorkItemId: identifierSchema,
  })
  .openapi("WorkItemDependency");
const noteSchema = z
  .object({
    id: z.uuid().max(36),
    workItemId: identifierSchema,
    leaseId: leaseIdSchema,
    content: z.string().min(1).max(MAX_TITLE_LENGTH),
    createdAt: timestampSchema,
  })
  .openapi("WorkItemNote");
const attentionRequestSchema = z
  .object({
    id: z.uuid().max(36),
    workItemId: identifierSchema,
    requestingLeaseId: leaseIdSchema,
    kind: z.string().min(1).max(100),
    question: z.string().min(1).max(MAX_TITLE_LENGTH),
    note: z.union([
      z.string().min(1).max(MAX_TITLE_LENGTH),
      z.null(),
    ]),
    blocking: z.boolean(),
    createdAt: timestampSchema,
  })
  .openapi("AttentionRequest");
const attentionResolutionSchema = z
  .object({
    id: z.uuid().max(36),
    attentionRequestId: z.uuid().max(36),
    resolution: z.string().min(1).max(MAX_TITLE_LENGTH),
    createdAt: timestampSchema,
  })
  .openapi("AttentionResolution");
const attentionRequestReadSchema = attentionRequestSchema
  .extend({ resolution: z.union([attentionResolutionSchema, z.null()]) })
  .openapi("AttentionRequestReadModel");
const attentionRequestListSchema = z
  .object({
    items: z.array(attentionRequestReadSchema).max(100),
    nextCursor: z.union([z.uuid().max(36), z.null()]),
  })
  .openapi("AttentionRequestList");
const attentionRequestResponseSchema = z
  .object({
    attentionRequest: attentionRequestSchema,
    endedLease: z.union([leaseSchema, z.null()]),
    workItem: workItemSchema,
  })
  .openapi("AttentionRequestResponse");
const attentionResolutionResponseSchema = z
  .object({
    resolution: attentionResolutionSchema,
    workItem: workItemSchema,
  })
  .openapi("AttentionResolutionResponse");
const leaseWithWorkItemSchema = z
  .object({ lease: leaseSchema, workItem: workItemSchema })
  .openapi("LeaseWithWorkItem");
const leaseResponseSchema = z
  .object({ lease: leaseSchema })
  .openapi("LeaseResponse");

const listWorkItemsQuerySchema = z.object({
  stage: z.enum(WORK_STAGES).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(DEFAULT_LIST_LIMIT)
    .openapi({ format: "int32" }),
  cursor: identifierSchema.optional(),
});
const listAttentionRequestsQuerySchema = z.object({
  state: z.enum(["unresolved", "resolved"]).default("unresolved"),
  blocking: z.enum(["true", "false"]).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(DEFAULT_LIST_LIMIT)
    .openapi({ format: "int32" }),
  cursor: z.uuid().max(36).optional(),
});
const workItemParamsSchema = z.object({ workItemId: identifierSchema });
const leaseParamsSchema = z.object({ leaseId: leaseIdSchema });
const attentionRequestParamsSchema = z.object({
  attentionRequestId: z.uuid().max(36),
});
const createWorkItemBodySchema = z
  .object({
    id: identifierSchema,
    title: z.string().trim().min(1).max(MAX_TITLE_LENGTH),
    parentId: z.union([identifierSchema, z.null()]).optional(),
  })
  .strict();
const dependencyBodySchema = workItemDependencySchema.strict();
const createNoteBodySchema = z
  .object({
    id: z.uuid().max(36),
    leaseId: leaseIdSchema,
    epoch: leaseEpochSchema,
    content: z.string().trim().min(1).max(MAX_TITLE_LENGTH),
  })
  .strict();
const createAttentionRequestBodySchema = z
  .object({
    id: z.uuid().max(36),
    workItemId: identifierSchema,
    leaseId: leaseIdSchema,
    epoch: leaseEpochSchema,
    kind: z.string().trim().min(1).max(100),
    question: z.string().trim().min(1).max(MAX_TITLE_LENGTH),
    note: z.string().trim().min(1).max(MAX_TITLE_LENGTH).optional(),
    blocking: z.boolean().default(true),
  })
  .strict();
const resolveAttentionRequestBodySchema = z
  .object({
    id: z.uuid().max(36),
    resolution: z.string().trim().min(1).max(MAX_TITLE_LENGTH),
  })
  .strict();
const createLeaseBodySchema = z
  .object({
    workerId: identifierSchema,
    leaseDurationSeconds: leaseDurationSchema,
    workItemId: identifierSchema.optional(),
  })
  .strict();
const renewLeaseBodySchema = z
  .object({
    epoch: leaseEpochSchema,
    leaseDurationSeconds: leaseDurationSchema,
  })
  .strict();
const terminateWorkItemBodySchema = z
  .object({ leaseId: leaseIdSchema, epoch: leaseEpochSchema })
  .strict();

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: errorSchema } },
});
const standardErrors = {
  400: errorResponse("Invalid request"),
  401: errorResponse("Cloudflare Access authentication required"),
  403: errorResponse("Cloudflare Access denied the request"),
  404: errorResponse("Resource not found"),
  409: errorResponse("Request conflicts with current Work Graph state"),
  422: errorResponse("Request validation failed"),
  500: errorResponse("Unexpected server error"),
};
const accessSecurity = [
  { cloudflareAccessClientId: [], cloudflareAccessClientSecret: [] },
];

const listWorkItemsRoute = createRoute({
  method: "get",
  path: "/api/work-items",
  operationId: "listWorkItems",
  summary: "List work items with their derived stage",
  description:
    "Returns one bounded page in stable work-item ID order. The optional stage filter uses the current derived projection. Pass nextCursor to continue after the last observed ID without offset drift during lease transitions.",
  tags: ["work-items"],
  security: accessSecurity,
  request: { query: listWorkItemsQuerySchema },
  responses: {
    200: {
      description: "Work items in stable work-item ID order",
      content: { "application/json": { schema: workItemListSchema } },
    },
    ...standardErrors,
  },
});

const getWorkItemRoute = createRoute({
  method: "get",
  path: "/api/work-items/{workItemId}",
  operationId: "getWorkItem",
  summary: "Read a work item with its derived stage",
  description:
    "Returns stored lifecycle data together with the current derived operational stage and lease.",
  tags: ["work-items"],
  security: accessSecurity,
  request: { params: workItemParamsSchema },
  responses: {
    200: {
      description: "Current work-item projection",
      content: { "application/json": { schema: workItemSchema } },
    },
    ...standardErrors,
  },
});

const createWorkItemRoute = createRoute({
  method: "post",
  path: "/api/work-items",
  operationId: "createWorkItem",
  summary: "Create a sparse work item",
  description:
    "Creates an open work item from its identity and title, with an optional parent. Lifecycle and operational stage are not accepted because the service derives them from graph state.",
  tags: ["work-items"],
  security: accessSecurity,
  request: {
    headers: idempotencyHeadersSchema,
    body: {
      required: true,
      content: { "application/json": { schema: createWorkItemBodySchema } },
    },
  },
  responses: {
    201: {
      description: "Work item created or matching mutation replayed",
      content: { "application/json": { schema: workItemSchema } },
    },
    ...standardErrors,
  },
});

const createDependencyRoute = createRoute({
  method: "post",
  path: "/api/dependencies",
  operationId: "createDependency",
  summary: "Add a work-item dependency",
  description:
    "Adds one explicit blocker edge after checking the serialized hierarchy and dependency waits-for graph for cycles.",
  tags: ["dependencies"],
  security: accessSecurity,
  request: {
    headers: idempotencyHeadersSchema,
    body: {
      required: true,
      content: { "application/json": { schema: dependencyBodySchema } },
    },
  },
  responses: {
    201: {
      description: "Dependency added or matching mutation replayed",
      content: { "application/json": { schema: workItemDependencySchema } },
    },
    ...standardErrors,
  },
});

const deleteDependencyRoute = createRoute({
  method: "delete",
  path: "/api/dependencies",
  operationId: "deleteDependency",
  summary: "Remove a work-item dependency",
  description:
    "Removes one explicit blocker edge without changing hierarchy or work-item lifecycle.",
  tags: ["dependencies"],
  security: accessSecurity,
  request: {
    headers: idempotencyHeadersSchema,
    body: {
      required: true,
      content: { "application/json": { schema: dependencyBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Dependency removed or matching mutation replayed",
      content: { "application/json": { schema: workItemDependencySchema } },
    },
    ...standardErrors,
  },
});

const createNoteRoute = createRoute({
  method: "post",
  path: "/api/work-items/{workItemId}/notes",
  operationId: "createWorkItemNote",
  summary: "Record a note for claimed work",
  description:
    "Records a short or long note only when the supplied lease ID and epoch still own the named work item.",
  tags: ["notes"],
  security: accessSecurity,
  request: {
    params: workItemParamsSchema,
    headers: idempotencyHeadersSchema,
    body: {
      required: true,
      content: { "application/json": { schema: createNoteBodySchema } },
    },
  },
  responses: {
    201: {
      description: "Note recorded or matching mutation replayed",
      content: { "application/json": { schema: noteSchema } },
    },
    ...standardErrors,
  },
});

const listAttentionRequestsRoute = createRoute({
  method: "get",
  path: "/api/attention-requests",
  operationId: "listAttentionRequests",
  summary: "List attention requests",
  description:
    "Returns unresolved requests by default in stable request-ID order. Filters can include resolved requests or select blocking and non-blocking work.",
  tags: ["attention"],
  security: accessSecurity,
  request: { query: listAttentionRequestsQuerySchema },
  responses: {
    200: {
      description: "Attention requests in stable request-ID order",
      content: { "application/json": { schema: attentionRequestListSchema } },
    },
    ...standardErrors,
  },
});

const createAttentionRequestRoute = createRoute({
  method: "post",
  path: "/api/attention-requests",
  operationId: "createAttentionRequest",
  summary: "Request attention for claimed work",
  description:
    "Records the decision or review needed. A blocking request atomically ends the current lease and removes the work item from the claimable queue.",
  tags: ["attention"],
  security: accessSecurity,
  request: {
    headers: idempotencyHeadersSchema,
    body: {
      required: true,
      content: {
        "application/json": { schema: createAttentionRequestBodySchema },
      },
    },
  },
  responses: {
    201: {
      description: "Attention request recorded or matching mutation replayed",
      content: {
        "application/json": { schema: attentionRequestResponseSchema },
      },
    },
    ...standardErrors,
  },
});

const resolveAttentionRequestRoute = createRoute({
  method: "post",
  path: "/api/attention-requests/{attentionRequestId}/resolutions",
  operationId: "createAttentionResolution",
  summary: "Resolve an attention request",
  description:
    "Records one resolution and returns the work item's newly derived stage. The item becomes ready only when no other readiness blocker remains.",
  tags: ["attention"],
  security: accessSecurity,
  request: {
    params: attentionRequestParamsSchema,
    headers: idempotencyHeadersSchema,
    body: {
      required: true,
      content: {
        "application/json": { schema: resolveAttentionRequestBodySchema },
      },
    },
  },
  responses: {
    201: {
      description: "Attention request resolved or matching mutation replayed",
      content: {
        "application/json": { schema: attentionResolutionResponseSchema },
      },
    },
    ...standardErrors,
  },
});

const createLeaseRoute = createRoute({
  method: "post",
  path: "/api/leases",
  operationId: "createLease",
  summary: "Claim a specified or first eligible work item",
  description:
    "Creates a fenced lease for the requested item, or for the first eligible item in stable fallback order when workItemId is absent.",
  tags: ["leases"],
  security: accessSecurity,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createLeaseBodySchema } },
    },
  },
  responses: {
    201: {
      description: "Lease created and work item claimed",
      content: { "application/json": { schema: leaseWithWorkItemSchema } },
    },
    ...standardErrors,
  },
});

const renewLeaseRoute = createRoute({
  method: "post",
  path: "/api/leases/{leaseId}/renewals",
  operationId: "createLeaseRenewal",
  summary: "Renew the current lease at its fenced epoch",
  description:
    "Extends a live lease only when its ID and epoch still identify the current worker claim.",
  tags: ["leases"],
  security: accessSecurity,
  request: {
    params: leaseParamsSchema,
    body: {
      required: true,
      content: { "application/json": { schema: renewLeaseBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Lease expiry extended",
      content: { "application/json": { schema: leaseResponseSchema } },
    },
    ...standardErrors,
  },
});

const releaseWorkItemRoute = createRoute({
  method: "post",
  path: "/api/work-items/{workItemId}/releases",
  operationId: "createWorkItemRelease",
  summary: "Release claimed work at its fenced lease epoch",
  description:
    "Ends the current lease and changes the named work item's stored lifecycle to released.",
  tags: ["work-items"],
  security: accessSecurity,
  request: {
    params: workItemParamsSchema,
    body: {
      required: true,
      content: { "application/json": { schema: terminateWorkItemBodySchema } },
    },
  },
  responses: {
    201: {
      description: "Work item released and lease ended",
      content: { "application/json": { schema: leaseWithWorkItemSchema } },
    },
    ...standardErrors,
  },
});

const cancelWorkItemRoute = createRoute({
  method: "post",
  path: "/api/work-items/{workItemId}/cancellations",
  operationId: "createWorkItemCancellation",
  summary: "Cancel claimed work at its fenced lease epoch",
  description:
    "Ends the current lease and changes the named work item's stored lifecycle to cancelled.",
  tags: ["work-items"],
  security: accessSecurity,
  request: {
    params: workItemParamsSchema,
    body: {
      required: true,
      content: { "application/json": { schema: terminateWorkItemBodySchema } },
    },
  },
  responses: {
    201: {
      description: "Work item cancelled and lease ended",
      content: { "application/json": { schema: leaseWithWorkItemSchema } },
    },
    ...standardErrors,
  },
});

export interface WorkGraphApiRepository {
  listWorkItems(): Promise<readonly WorkItemReadModel[]>;
  getWorkItem(workItemId: string): Promise<WorkItemReadModel>;
  listAttentionRequests(): Promise<readonly AttentionRequestReadModel[]>;
  createWorkItem(
    input: NewWorkItemInput,
    options?: IdempotentMutationOptions,
  ): Promise<WorkItem>;
  addDependency(
    dependency: WorkItemDependency,
    options?: IdempotentMutationOptions,
  ): Promise<void>;
  removeDependency(
    dependency: WorkItemDependency,
    options?: IdempotentMutationOptions,
  ): Promise<void>;
  createNote(
    input: CreateNoteInput,
    options?: IdempotentMutationOptions,
  ): Promise<StoredNote>;
  createAttentionRequest(
    input: CreateAttentionRequestInput,
    options?: IdempotentMutationOptions,
  ): Promise<CreateAttentionRequestResult>;
  resolveAttentionRequest(
    input: ResolveAttentionRequestInput,
    options?: IdempotentMutationOptions,
  ): Promise<ResolveAttentionRequestResult>;
  claimWorkItem(input: ClaimWorkItemInput): Promise<StoredLease | null>;
  renewLease(input: RenewLeaseInput): Promise<StoredLease>;
  terminateClaimedWorkItem(
    input: TerminateClaimedWorkItemInput,
  ): Promise<StoredLease>;
}

export interface WorkGraphAppOptions {
  readonly createLeaseId?: () => string;
}

const idempotencyOptions = (
  key: string | undefined,
): IdempotentMutationOptions =>
  key === undefined ? {} : { idempotencyKey: key };

const serializeLease = (storedLease: StoredLease) => ({
  ...storedLease,
  acquiredAt: storedLease.acquiredAt.toISOString(),
  expiresAt: storedLease.expiresAt.toISOString(),
  endedAt: storedLease.endedAt?.toISOString() ?? null,
});

const serializeWorkItem = (item: WorkItemReadModel) => ({
  ...item,
  currentLease: item.currentLease ? serializeLease(item.currentLease) : null,
});

const serializeNote = (storedNote: StoredNote) => ({
  ...storedNote,
  createdAt: storedNote.createdAt.toISOString(),
});

const serializeAttentionRequest = (stored: StoredAttentionRequest) => ({
  ...stored,
  createdAt: stored.createdAt.toISOString(),
});

const serializeAttentionResolution = (
  stored: StoredAttentionResolution,
) => ({
  ...stored,
  createdAt: stored.createdAt.toISOString(),
});

const serializeAttentionRequestReadModel = (
  stored: AttentionRequestReadModel,
) => ({
  ...serializeAttentionRequest(stored),
  resolution: stored.resolution
    ? serializeAttentionResolution(stored.resolution)
    : null,
});

const validationHook: Hook<unknown, Env, string, Response | void> = (
  result,
  context,
) => {
  if (result.success) return;
  return context.json(
    {
      error: {
        code: "validation_failed",
        message: "The request does not match the API contract.",
        details: result.error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message,
        })),
      },
    },
    422,
  );
};

const statusForWorkGraphError = (error: WorkGraphError): 400 | 404 | 409 => {
  if (
    error.code === "work_item_not_found" ||
    error.code === "attention_request_not_found"
  ) {
    return 404;
  }
  if (error.code.startsWith("invalid_")) return 400;
  return 409;
};

export const createWorkGraphApp = (
  repository: WorkGraphApiRepository,
  options: WorkGraphAppOptions = {},
) => {
  const app = new OpenAPIHono({ defaultHook: validationHook });
  const createLeaseId = options.createLeaseId ?? (() => crypto.randomUUID());

  app.openAPIRegistry.registerComponent(
    "securitySchemes",
    "cloudflareAccessClientId",
    {
      type: "apiKey",
      in: "header",
      name: "CF-Access-Client-Id",
      description: "Cloudflare Access service-token client ID",
    },
  );
  app.openAPIRegistry.registerComponent(
    "securitySchemes",
    "cloudflareAccessClientSecret",
    {
      type: "apiKey",
      in: "header",
      name: "CF-Access-Client-Secret",
      description: "Cloudflare Access service-token client secret",
    },
  );

  app.onError((error, context) => {
    if (error instanceof WorkGraphError) {
      return context.json(
        { error: { code: error.code, message: error.message } },
        statusForWorkGraphError(error),
      );
    }
    console.error(
      JSON.stringify({
        message: "Work Graph request failed",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return context.json(
      {
        error: {
          code: "internal_error",
          message: "The Work Graph request failed.",
        },
      },
      500,
    );
  });
  app.notFound((context) =>
    context.json(
      { error: { code: "not_found", message: "Resource not found." } },
      404,
    ),
  );

  app.openapi(listWorkItemsRoute, async (context) => {
    const { cursor, limit, stage } = context.req.valid("query");
    const items = await repository.listWorkItems();
    const matchingItems = items.filter(
      (item) =>
        (stage === undefined || item.stage === stage) &&
        (cursor === undefined || item.id > cursor),
    );
    matchingItems.sort((left, right) =>
      left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
    );
    const page = matchingItems.slice(0, limit);
    return context.json(
      {
        items: page.map(serializeWorkItem),
        nextCursor:
          page.length < matchingItems.length
            ? (page.at(-1)?.id ?? null)
            : null,
      },
      200,
    );
  });

  app.openapi(getWorkItemRoute, async (context) => {
    const { workItemId } = context.req.valid("param");
    return context.json(
      serializeWorkItem(await repository.getWorkItem(workItemId)),
      200,
    );
  });

  app.openapi(createWorkItemRoute, async (context) => {
    const request = context.req.valid("json");
    const headers = context.req.valid("header");
    await repository.createWorkItem(
      request,
      idempotencyOptions(headers["idempotency-key"]),
    );
    return context.json(
      serializeWorkItem(await repository.getWorkItem(request.id)),
      201,
    );
  });

  app.openapi(createDependencyRoute, async (context) => {
    const dependency = context.req.valid("json");
    const headers = context.req.valid("header");
    await repository.addDependency(
      dependency,
      idempotencyOptions(headers["idempotency-key"]),
    );
    return context.json(dependency, 201);
  });

  app.openapi(deleteDependencyRoute, async (context) => {
    const dependency = context.req.valid("json");
    const headers = context.req.valid("header");
    await repository.removeDependency(
      dependency,
      idempotencyOptions(headers["idempotency-key"]),
    );
    return context.json(dependency, 200);
  });

  app.openapi(createNoteRoute, async (context) => {
    const { workItemId } = context.req.valid("param");
    const request = context.req.valid("json");
    const headers = context.req.valid("header");
    const created = await repository.createNote(
      { ...request, workItemId },
      idempotencyOptions(headers["idempotency-key"]),
    );
    return context.json(serializeNote(created), 201);
  });

  app.openapi(listAttentionRequestsRoute, async (context) => {
    const { blocking, cursor, limit, state } = context.req.valid("query");
    const requests = await repository.listAttentionRequests();
    const matchingRequests = requests.filter(
      (request) =>
        (state === "resolved"
          ? request.resolution !== null
          : request.resolution === null) &&
        (blocking === undefined ||
          request.blocking === (blocking === "true")) &&
        (cursor === undefined || request.id > cursor),
    );
    matchingRequests.sort((left, right) => {
      if (left.id < right.id) return -1;
      if (left.id > right.id) return 1;
      return 0;
    });
    const page = matchingRequests.slice(0, limit);
    return context.json(
      {
        items: page.map(serializeAttentionRequestReadModel),
        nextCursor:
          page.length < matchingRequests.length
            ? (page.at(-1)?.id ?? null)
            : null,
      },
      200,
    );
  });

  app.openapi(createAttentionRequestRoute, async (context) => {
    const request = context.req.valid("json");
    const headers = context.req.valid("header");
    const created = await repository.createAttentionRequest(
      request,
      idempotencyOptions(headers["idempotency-key"]),
    );
    const item = await repository.getWorkItem(request.workItemId);
    return context.json(
      {
        attentionRequest: serializeAttentionRequest(
          created.attentionRequest,
        ),
        endedLease: created.endedLease
          ? serializeLease(created.endedLease)
          : null,
        workItem: serializeWorkItem(item),
      },
      201,
    );
  });

  app.openapi(resolveAttentionRequestRoute, async (context) => {
    const { attentionRequestId } = context.req.valid("param");
    const request = context.req.valid("json");
    const headers = context.req.valid("header");
    const resolved = await repository.resolveAttentionRequest(
      { ...request, attentionRequestId },
      idempotencyOptions(headers["idempotency-key"]),
    );
    const item = await repository.getWorkItem(resolved.workItemId);
    return context.json(
      {
        resolution: serializeAttentionResolution(resolved.resolution),
        workItem: serializeWorkItem(item),
      },
      201,
    );
  });

  app.openapi(createLeaseRoute, async (context) => {
    const request = context.req.valid("json");
    const claimed = await repository.claimWorkItem({
      leaseId: createLeaseId(),
      workerId: request.workerId,
      leaseDurationSeconds: request.leaseDurationSeconds,
      ...(request.workItemId ? { workItemId: request.workItemId } : {}),
    });
    if (!claimed) {
      return context.json(
        {
          error: {
            code: "work_item_not_claimable",
            message: request.workItemId
              ? `Work item ${request.workItemId} is not claimable.`
              : "No work item is currently claimable.",
          },
        },
        409,
      );
    }
    const item = await repository.getWorkItem(claimed.workItemId);
    return context.json(
      { lease: serializeLease(claimed), workItem: serializeWorkItem(item) },
      201,
    );
  });

  app.openapi(renewLeaseRoute, async (context) => {
    const { leaseId } = context.req.valid("param");
    const request = context.req.valid("json");
    const renewed = await repository.renewLease({ leaseId, ...request });
    return context.json({ lease: serializeLease(renewed) }, 200);
  });

  app.openapi(releaseWorkItemRoute, async (context) => {
    const { workItemId } = context.req.valid("param");
    const request = context.req.valid("json");
    const ended = await repository.terminateClaimedWorkItem({
      ...request,
      workItemId,
      outcome: "released",
    });
    const item = await repository.getWorkItem(workItemId);
    return context.json(
      { lease: serializeLease(ended), workItem: serializeWorkItem(item) },
      201,
    );
  });

  app.openapi(cancelWorkItemRoute, async (context) => {
    const { workItemId } = context.req.valid("param");
    const request = context.req.valid("json");
    const ended = await repository.terminateClaimedWorkItem({
      ...request,
      workItemId,
      outcome: "cancelled",
    });
    const item = await repository.getWorkItem(workItemId);
    return context.json(
      { lease: serializeLease(ended), workItem: serializeWorkItem(item) },
      201,
    );
  });

  return app;
};
