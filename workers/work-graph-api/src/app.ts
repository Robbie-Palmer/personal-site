import {
  createRoute,
  OpenAPIHono,
  type Hook,
} from "@hono/zod-openapi";
import type { Env } from "hono";
import type {
  ClaimWorkItemInput,
  RenewLeaseInput,
  StoredLease,
  TerminateClaimedWorkItemInput,
  WorkItemReadModel,
} from "work-graph-db";
import {
  LEASE_OUTCOMES,
  WORK_ITEM_LIFECYCLES,
  WORK_STAGES,
  WorkGraphError,
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
    nextOffset: z.union([leaseEpochSchema, z.null()]),
  })
  .openapi("WorkItemList");
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
  offset: z.coerce
    .number()
    .int()
    .min(0)
    .max(2_147_483_646)
    .default(0)
    .openapi({ format: "int32" }),
});
const workItemParamsSchema = z.object({ workItemId: identifierSchema });
const leaseParamsSchema = z.object({ leaseId: leaseIdSchema });
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
    "Returns one bounded page in stable creation order. The optional stage filter uses the current derived projection.",
  tags: ["work-items"],
  security: accessSecurity,
  request: { query: listWorkItemsQuerySchema },
  responses: {
    200: {
      description: "Work items in stable creation order",
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
  claimWorkItem(input: ClaimWorkItemInput): Promise<StoredLease | null>;
  renewLease(input: RenewLeaseInput): Promise<StoredLease>;
  terminateClaimedWorkItem(
    input: TerminateClaimedWorkItemInput,
  ): Promise<StoredLease>;
}

export interface WorkGraphAppOptions {
  readonly createLeaseId?: () => string;
}

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
  if (error.code === "work_item_not_found") return 404;
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
    const { limit, offset, stage } = context.req.valid("query");
    const items = await repository.listWorkItems();
    const matchingItems = items.filter(
      (item) => stage === undefined || item.stage === stage,
    );
    const page = matchingItems.slice(offset, offset + limit);
    return context.json(
      {
        items: page.map(serializeWorkItem),
        nextOffset:
          offset + page.length < matchingItems.length
            ? offset + page.length
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
