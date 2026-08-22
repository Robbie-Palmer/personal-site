import type { AgentAuthEvent, AgentSession } from "@better-auth/agent-auth";
import type { Db } from "recipe-db";
import type * as schema from "recipe-db/schema";
import { describe, expect, it, vi } from "vitest";
import {
  createRecipeAgentAuthPlugin,
  escapedLikePattern,
  executeRecipeAgentCapability,
  RECIPE_AGENT_CAPABILITIES,
} from "../src/agent-auth";
import { createAuth } from "../src/auth";

function queryDb(...results: unknown[][]): Db {
  let resultIndex = 0;
  return {
    select: () => {
      const result = results[resultIndex++] ?? [];
      const query = {
        from: () => query,
        where: () => query,
        orderBy: () => query,
        limit: () => Promise.resolve(result),
        then: <TResult1 = unknown[]>(
          resolve?:
            | ((value: unknown[]) => TResult1 | PromiseLike<TResult1>)
            | null,
        ) => Promise.resolve(result).then(resolve),
      };
      return query;
    },
  } as unknown as Db;
}

function secondaryStorageDb(
  rows: Array<{ value: string; expiresAt: Date | null }>,
) {
  const state = {
    rows,
    writes: [] as Array<{ key: string; value: string; expiresAt: Date | null }>,
    deleteCount: 0,
  };
  const db = {
    select: () => {
      const query = {
        from: () => query,
        where: () => query,
        limit: () => Promise.resolve(state.rows),
      };
      return query;
    },
    insert: () => ({
      values: (values: {
        key: string;
        value: string;
        expiresAt: Date | null;
      }) => {
        state.writes.push(values);
        return { onConflictDoUpdate: () => Promise.resolve() };
      },
    }),
    delete: () => ({
      where: () => {
        state.deleteCount += 1;
        return Promise.resolve();
      },
    }),
  } as unknown as Db;
  return { db, state };
}

function jtiReservationDb() {
  const state = {
    reserved: false,
    writes: [] as Array<{ key: string; value: string; expiresAt: Date }>,
  };
  const transactionDb = {
    delete: () => ({ where: () => Promise.resolve() }),
    insert: () => ({
      values: (values: { key: string; value: string; expiresAt: Date }) => {
        state.writes.push(values);
        return {
          onConflictDoNothing: () => ({
            returning: () => {
              if (state.reserved) return Promise.resolve([]);
              state.reserved = true;
              return Promise.resolve([{ key: values.key }]);
            },
          }),
        };
      },
    }),
  };
  const db = {
    transaction: (callback: (tx: typeof transactionDb) => Promise<unknown>) =>
      callback(transactionDb),
  } as unknown as Db;
  return { db, state };
}

function agentSession(userId = "delegating-user"): AgentSession {
  return {
    type: "delegated",
    agentId: "agent-1",
    userId,
    agent: {
      id: "agent-1",
      name: "Recipe helper",
      mode: "delegated",
      capabilityGrants: [],
      hostId: "host-1",
      createdAt: new Date("2026-08-22T08:00:00Z"),
      activatedAt: new Date("2026-08-22T08:01:00Z"),
      metadata: null,
    },
    host: { id: "host-1", userId, status: "active" },
    user: {
      id: userId,
      name: "Delegating user",
      email: "delegating-user@example.test",
    },
  };
}

function recipe(
  overrides: Partial<typeof schema.recipe.$inferSelect> = {},
): typeof schema.recipe.$inferSelect {
  return {
    id: "00000000-0000-4000-8000-000000000061",
    slug: "tomato-soup",
    title: "Tomato Soup",
    description: "A quick soup",
    body: "Add @tomato{2} and simmer.",
    userId: "delegating-user",
    visibility: "private",
    createdAt: new Date("2026-08-20T08:00:00Z"),
    updatedAt: new Date("2026-08-21T08:00:00Z"),
    ...overrides,
  };
}

describe("recipe Agent Auth capabilities", () => {
  it("keeps PostgreSQL secondary storage after applying Cloudflare options", () => {
    const auth = createAuth({} as Db, {
      BETTER_AUTH_URL: "https://recipes.example.test",
      BETTER_AUTH_SECRET: "test-secret-at-least-32-characters-long",
    });

    expect(auth.options.secondaryStorage).toBeDefined();
  });

  it("reads, expires, writes, and deletes replay-protection entries", async () => {
    const { db, state } = secondaryStorageDb([
      { value: "cached-jti", expiresAt: new Date(Date.now() + 60_000) },
    ]);
    const auth = createAuth(db, {
      BETTER_AUTH_URL: "https://recipes.example.test",
      BETTER_AUTH_SECRET: "test-secret-at-least-32-characters-long",
    });
    const storage = auth.options.secondaryStorage;
    expect(storage).toBeDefined();
    if (!storage) throw new Error("Secondary storage was not configured");

    await expect(storage.get("jti:active")).resolves.toBe("cached-jti");
    await storage.set("jti:new", "new-value", 60);
    await storage.delete("jti:new");

    expect(state.writes).toHaveLength(1);
    expect(state.writes[0]).toMatchObject({
      key: "jti:new",
      value: "new-value",
    });
    expect(state.writes[0]?.expiresAt?.getTime()).toBeGreaterThan(Date.now());
    expect(state.deleteCount).toBe(1);

    state.rows = [
      { value: "expired-jti", expiresAt: new Date(Date.now() - 60_000) },
    ];
    await expect(storage.get("jti:expired")).resolves.toBeNull();
    expect(state.deleteCount).toBe(2);

    state.rows = [];
    await expect(storage.get("jti:missing")).resolves.toBeNull();
  });

  it("atomically reserves JTI keys before Better Auth stores them", async () => {
    const { db, state } = jtiReservationDb();
    const auth = createAuth(db, {
      BETTER_AUTH_URL: "https://recipes.example.test",
      BETTER_AUTH_SECRET: "test-secret-at-least-32-characters-long",
    });
    const storage = auth.options.secondaryStorage;
    if (!storage) throw new Error("Secondary storage was not configured");

    const key = "agent-auth:jti:agent-1:jti-1";
    await expect(Promise.all([storage.get(key), storage.get(key)])).resolves.toEqual([
      null,
      "1",
    ]);
    expect(state.writes).toHaveLength(2);
    expect(state.writes[0]).toMatchObject({ key, value: "1" });
    expect(state.writes[0]?.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("exposes only the first delegated read slice", () => {
    expect(
      RECIPE_AGENT_CAPABILITIES.map((capability) => capability.name),
    ).toEqual(["recipes.search", "recipes.read"]);
    expect(
      RECIPE_AGENT_CAPABILITIES.every(
        (capability) =>
          capability.approvalStrength === "session" &&
          capability.grantTTL === 30 * 24 * 60 * 60,
      ),
    ).toBe(true);
  });

  it("bounds recipe search input and result size", () => {
    const search = RECIPE_AGENT_CAPABILITIES.find(
      (capability) => capability.name === "recipes.search",
    );

    expect(search?.input).toMatchObject({
      additionalProperties: false,
      required: ["query"],
      properties: {
        query: { minLength: 1, maxLength: 200 },
        limit: { minimum: 1, maximum: 25, default: 10 },
      },
    });
    expect(search?.output).toMatchObject({
      properties: { items: { maxItems: 25 } },
    });
  });

  it("searches recipes visible to a user without a household", async () => {
    expect(escapedLikePattern(String.raw`tomato%_\soup`)).toBe(
      String.raw`%tomato\%\_\\soup%`,
    );

    const result = await executeRecipeAgentCapability(
      queryDb([], [recipe()]),
      "recipes.search",
      { query: String.raw`tomato%_\soup`, limit: 5 },
      agentSession(),
    );

    expect(result).toEqual({
      items: [
        {
          id: "00000000-0000-4000-8000-000000000061",
          slug: "tomato-soup",
          title: "Tomato Soup",
          description: "A quick soup",
          visibility: "private",
          owned: true,
          updatedAt: new Date("2026-08-21T08:00:00Z"),
        },
      ],
    });
  });

  it("includes household-visible recipes for household members", async () => {
    const result = await executeRecipeAgentCapability(
      queryDb(
        [{ organizationId: "household-1" }],
        [{ userId: "delegating-user" }, { userId: "housemate" }],
        [
          recipe({
            slug: "household-stew",
            title: "Household Stew",
            userId: "housemate",
            visibility: "household",
          }),
        ],
      ),
      "recipes.search",
      { query: "stew" },
      agentSession(),
    );

    expect(result.items).toMatchObject([
      { slug: "household-stew", visibility: "household", owned: false },
    ]);
  });

  it("reads one visible recipe with its Cooklang body", async () => {
    const result = await executeRecipeAgentCapability(
      queryDb([], [recipe()]),
      "recipes.read",
      { slug: "tomato-soup" },
      agentSession(),
    );

    expect(result).toMatchObject({
      recipe: {
        slug: "tomato-soup",
        body: "Add @tomato{2} and simmer.",
      },
    });
  });

  it("returns null when a recipe is not visible", async () => {
    await expect(
      executeRecipeAgentCapability(
        queryDb([], []),
        "recipes.read",
        { slug: "missing-recipe" },
        agentSession(),
      ),
    ).resolves.toEqual({ recipe: null });
  });

  it("rejects malformed and unsupported capability requests", async () => {
    await expect(
      executeRecipeAgentCapability(
        queryDb([]),
        "recipes.read",
        { slug: "NOT A SLUG" },
        agentSession(),
      ),
    ).rejects.toThrow();
    await expect(
      executeRecipeAgentCapability(
        queryDb([]),
        "recipes.delete",
        {},
        agentSession(),
      ),
    ).rejects.toThrow("Unsupported recipe capability: recipes.delete");
  });

  it("validates, executes, and audits through the Agent Auth callbacks", async () => {
    const auditValues: Record<string, unknown>[] = [];
    const db = Object.assign(queryDb([], [recipe()]), {
      insert: vi.fn(() => ({
        values: (values: Record<string, unknown>) => {
          auditValues.push(values);
          return Promise.resolve();
        },
      })),
    }) as Db;
    const plugin = createRecipeAgentAuthPlugin(db);
    const options = plugin.options;
    if (!options) throw new Error("Agent Auth options were not exposed");

    expect(
      await options.validateCapabilities?.([
        "recipes.search",
        "recipes.read",
      ]),
    ).toBe(true);
    expect(
      await options.validateCapabilities?.(["recipes.delete"]),
    ).toBe(false);

    const executed = await options.onExecute?.({
      capability: "recipes.read",
      arguments: { slug: "tomato-soup" },
      agentSession: agentSession(),
    } as never);
    expect(executed).toMatchObject({ recipe: { slug: "tomato-soup" } });

    const events: AgentAuthEvent[] = [
      {
        type: "capability.executed",
        actorType: "agent",
        actorId: "agent-1",
        agentId: "agent-1",
        userId: "delegating-user",
        capability: "recipes.read",
        status: "success",
        durationMs: 12,
      },
      {
        type: "capability.approved",
        actorType: "user",
        actorId: "delegating-user",
        agentId: "agent-1",
      },
    ];
    for (const event of events) await options.onEvent?.(event);

    expect(auditValues).toEqual([
      expect.objectContaining({
        eventType: "capability.executed",
        userId: "delegating-user",
        capability: "recipes.read",
        outcome: "success",
        durationMs: 12,
      }),
      expect.objectContaining({
        eventType: "capability.approved",
        userId: "delegating-user",
      }),
    ]);
  });
});
