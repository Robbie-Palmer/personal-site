import {
  agentAuth,
  type AgentAuthEvent,
  type AgentSession,
  type Capability,
} from "@better-auth/agent-auth";
import { and, desc, eq, ilike, inArray, or, type SQL } from "drizzle-orm";
import type { Db } from "recipe-db";
import * as schema from "recipe-db/schema";
import { z } from "zod";

const READ_GRANT_TTL_SECONDS = 30 * 24 * 60 * 60;
const MAX_AGENT_LIFETIME_SECONDS = 30 * 24 * 60 * 60;
const AGENT_AUTH_PROVIDER_NAME = "Robbie's Recipes";
const AGENT_AUTH_PROVIDER_DESCRIPTION =
  "Delegated access to recipes and personal cooking data.";
const AGENT_AUTH_MODES = ["delegated"] as const;
const AGENT_AUTH_APPROVAL_METHODS = ["device_authorization"] as const;

export function recipeAgentConfiguration(baseUrl: string) {
  const issuer = `${new URL(baseUrl).origin}/api/auth`;
  const paths = {
    register: "/agent/register",
    capabilities: "/capability/list",
    describe_capability: "/capability/describe",
    execute: "/capability/execute",
    request_capability: "/agent/request-capability",
    status: "/agent/status",
    reactivate: "/agent/reactivate",
    revoke: "/agent/revoke",
    revoke_host: "/host/revoke",
    rotate_key: "/agent/rotate-key",
    rotate_host_key: "/host/rotate-key",
    introspect: "/agent/introspect",
  };
  const endpoints = Object.fromEntries(
    Object.entries(paths).map(([name, path]) => [name, `${issuer}${path}`]),
  );

  return {
    version: "1.0-draft",
    provider_name: AGENT_AUTH_PROVIDER_NAME,
    description: AGENT_AUTH_PROVIDER_DESCRIPTION,
    issuer,
    default_location: endpoints.execute,
    algorithms: ["Ed25519"],
    modes: [...AGENT_AUTH_MODES],
    approval_methods: [...AGENT_AUTH_APPROVAL_METHODS],
    endpoints,
  };
}

const recipeSearchInput = z
  .object({
    query: z.string().trim().min(1).max(200),
    limit: z.number().int().min(1).max(25).default(10),
  })
  .strict();

const recipeReadInput = z
  .object({
    slug: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  })
  .strict();

const recipeSummarySchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "slug",
    "title",
    "description",
    "visibility",
    "owned",
    "updatedAt",
  ],
  properties: {
    id: { type: "string", format: "uuid" },
    slug: { type: "string" },
    title: { type: "string" },
    description: { type: ["string", "null"] },
    visibility: { enum: ["public", "private", "household"] },
    owned: { type: "boolean" },
    updatedAt: { type: "string", format: "date-time" },
  },
} as const;

export const RECIPE_AGENT_CAPABILITIES = [
  {
    name: "recipes.search",
    description:
      "Search recipes visible to the delegated user by title, description, ingredient, or instruction text.",
    approvalStrength: "session",
    grantTTL: READ_GRANT_TTL_SECONDS,
    input: {
      type: "object",
      additionalProperties: false,
      required: ["query"],
      properties: {
        query: { type: "string", minLength: 1, maxLength: 200 },
        limit: { type: "integer", minimum: 1, maximum: 25, default: 10 },
      },
    },
    output: {
      type: "object",
      additionalProperties: false,
      required: ["items"],
      properties: {
        items: { type: "array", maxItems: 25, items: recipeSummarySchema },
      },
    },
  },
  {
    name: "recipes.read",
    description:
      "Read one recipe visible to the delegated user, including its Cooklang body.",
    approvalStrength: "session",
    grantTTL: READ_GRANT_TTL_SECONDS,
    input: {
      type: "object",
      additionalProperties: false,
      required: ["slug"],
      properties: {
        slug: {
          type: "string",
          minLength: 1,
          maxLength: 120,
          pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
        },
      },
    },
    output: {
      type: "object",
      additionalProperties: false,
      required: ["recipe"],
      properties: {
        recipe: {
          anyOf: [
            {
              ...recipeSummarySchema,
              required: [...recipeSummarySchema.required, "body"],
              properties: {
                ...recipeSummarySchema.properties,
                body: { type: ["string", "null"] },
              },
            },
            { type: "null" },
          ],
        },
      },
    },
  },
] satisfies Capability[];

export function escapedLikePattern(value: string): string {
  const escape = String.fromCodePoint(92);
  const escaped = value
    .replaceAll(escape, escape.repeat(2))
    .replaceAll("%", escape + "%")
    .replaceAll("_", escape + "_");
  return "%" + escaped + "%";
}

async function readableRecipeFilter(db: Db, userId: string): Promise<SQL> {
  const [membership] = await db
    .select({ organizationId: schema.member.organizationId })
    .from(schema.member)
    .where(eq(schema.member.userId, userId))
    .limit(1);

  if (!membership) {
    return or(
      eq(schema.recipe.visibility, "public"),
      eq(schema.recipe.userId, userId),
    )!;
  }

  const members = await db
    .select({ userId: schema.member.userId })
    .from(schema.member)
    .where(eq(schema.member.organizationId, membership.organizationId));
  const memberIds = members.map((member) => member.userId);

  return or(
    eq(schema.recipe.visibility, "public"),
    eq(schema.recipe.userId, userId),
    and(
      eq(schema.recipe.visibility, "household"),
      inArray(schema.recipe.userId, memberIds),
    ),
  )!;
}

function recipeSummary(
  recipe: typeof schema.recipe.$inferSelect,
  userId: string,
) {
  return {
    id: recipe.id,
    slug: recipe.slug,
    title: recipe.title,
    description: recipe.description,
    visibility: recipe.visibility,
    owned: recipe.userId === userId,
    updatedAt: recipe.updatedAt,
  };
}

export async function executeRecipeAgentCapability(
  db: Db,
  capability: string,
  args: Record<string, unknown> | undefined,
  agentSession: AgentSession,
) {
  const userId = agentSession.user.id;
  const visibility = await readableRecipeFilter(db, userId);

  if (capability === "recipes.search") {
    const input = recipeSearchInput.parse(args ?? {});
    const pattern = escapedLikePattern(input.query);
    const recipes = await db
      .select()
      .from(schema.recipe)
      .where(
        and(
          visibility,
          or(
            ilike(schema.recipe.title, pattern),
            ilike(schema.recipe.description, pattern),
            ilike(schema.recipe.body, pattern),
          ),
        ),
      )
      .orderBy(desc(schema.recipe.updatedAt), desc(schema.recipe.id))
      .limit(input.limit);

    return { items: recipes.map((recipe) => recipeSummary(recipe, userId)) };
  }

  if (capability === "recipes.read") {
    const input = recipeReadInput.parse(args ?? {});
    const [recipe] = await db
      .select()
      .from(schema.recipe)
      .where(and(visibility, eq(schema.recipe.slug, input.slug)))
      .limit(1);

    return {
      recipe: recipe
        ? { ...recipeSummary(recipe, userId), body: recipe.body }
        : null,
    };
  }

  throw new Error(`Unsupported recipe capability: ${capability}`);
}

async function writeAgentAuthAuditEvent(db: Db, event: AgentAuthEvent) {
  let userId: string | undefined;
  if (event.type === "capability.executed") {
    userId = event.userId;
  } else if (event.actorType === "user") {
    userId = event.actorId;
  }

  await db.insert(schema.agentAuthAuditEvent).values({
    eventType: event.type,
    actorType: event.actorType,
    actorId: event.actorId,
    userId,
    agentId: event.agentId,
    hostId: event.hostId,
    targetType: event.targetType,
    targetId: event.targetId,
    capability:
      event.type === "capability.executed" ? event.capability : undefined,
    outcome: event.type === "capability.executed" ? event.status : undefined,
    durationMs:
      event.type === "capability.executed" ? event.durationMs : undefined,
  });
}

export function createRecipeAgentAuthPlugin(db: Db) {
  return agentAuth({
    providerName: AGENT_AUTH_PROVIDER_NAME,
    providerDescription: AGENT_AUTH_PROVIDER_DESCRIPTION,
    modes: [...AGENT_AUTH_MODES],
    approvalMethods: [...AGENT_AUTH_APPROVAL_METHODS],
    deviceAuthorizationPage: "/recipes/settings/agents/approve",
    capabilities: RECIPE_AGENT_CAPABILITIES,
    validateCapabilities: (capabilities) =>
      capabilities.every((name) =>
        RECIPE_AGENT_CAPABILITIES.some((capability) => capability.name === name),
      ),
    allowDynamicHostRegistration: false,
    defaultHostCapabilities: [],
    jwtMaxAge: 60,
    agentSessionTTL: MAX_AGENT_LIFETIME_SECONDS,
    agentMaxLifetime: MAX_AGENT_LIFETIME_SECONDS,
    absoluteLifetime: 90 * 24 * 60 * 60,
    // Better Auth checks a JTI with get() before its later set(). The
    // PostgreSQL adapter claims agent-auth:jti keys atomically inside get(),
    // so concurrent requests cannot both observe an unused token.
    jtiCacheStorage: "secondary-storage",
    jwksCacheStorage: "secondary-storage",
    onEvent: (event) => writeAgentAuthAuditEvent(db, event),
    onExecute: ({ capability, arguments: args, agentSession }) =>
      executeRecipeAgentCapability(db, capability, args, agentSession),
  });
}
