import { beforeEach, describe, it, expect, vi } from "vitest";
import postgres from "postgres";

const authzMock = vi.hoisted(() => ({
  session: null as unknown,
}));

const dbMock = vi.hoisted(() => {
  const date = new Date("2026-01-01T00:00:00.000Z");
  type UserRow = {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image: string | null;
    role: string | null;
    banned: boolean | null;
    banReason: string | null;
    banExpires: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };
  type OrganizationRow = {
    id: string;
    name: string;
    slug: string;
    logo: string | null;
    metadata: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  type MemberRow = {
    id: string;
    organizationId: string;
    userId: string;
    role: string;
    createdAt: Date;
  };
  type InvitationRow = {
    id: string;
    organizationId: string;
    email: string;
    role: string;
    status: string;
    expiresAt: Date;
    inviterId: string;
    createdAt: Date;
  };
  type RecipeRow = {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    body: string | null;
    userId: string;
    visibility: "public" | "private" | "household";
    createdAt: Date;
    updatedAt: Date;
  };

  const state = {
    users: [] as UserRow[],
    organizations: [] as OrganizationRow[],
    members: [] as MemberRow[],
    invitations: [] as InvitationRow[],
    recipes: [] as RecipeRow[],
    rateLimitCounts: new Map<string, number>(),
  };

  const organizationRow = (organization: OrganizationRow) => [
    organization.id,
    organization.name,
    organization.slug,
    organization.logo,
    organization.metadata,
    organization.createdAt,
    organization.updatedAt,
  ];
  const memberRow = (member: MemberRow) => [
    member.id,
    member.organizationId,
    member.userId,
    member.role,
    member.createdAt,
  ];
  const invitationRow = (invitation: InvitationRow) => [
    invitation.id,
    invitation.organizationId,
    invitation.email,
    invitation.role,
    invitation.status,
    invitation.expiresAt,
    invitation.inviterId,
    invitation.createdAt,
  ];
  const recipeRow = (recipe: RecipeRow) => [
    recipe.id,
    recipe.slug,
    recipe.title,
    recipe.description,
    recipe.body,
    recipe.userId,
    recipe.visibility,
    recipe.createdAt,
    recipe.updatedAt,
  ];

  function reset() {
    state.users = [];
    state.organizations = [];
    state.members = [];
    state.invitations = [];
    state.recipes = [];
    state.rateLimitCounts.clear();
  }

  function queryRows(query: string, params: unknown[] = []) {
    if (query.startsWith('insert into "app_rate_limit"')) {
      const key = params[0] as string;
      const count = (state.rateLimitCounts.get(key) ?? 0) + 1;
      state.rateLimitCounts.set(key, count);
      // [count, windowStart] — drizzle .returning() maps these by column order.
      return [[count, date]];
    }

    if (query.startsWith('insert into "organization"')) {
      const organization: OrganizationRow = {
        id: params[0] as string,
        name: params[1] as string,
        slug: params[2] as string,
        logo: null,
        metadata: null,
        createdAt: date,
        updatedAt: date,
      };
      state.organizations.push(organization);
      return [organizationRow(organization)];
    }

    if (query.startsWith('insert into "member"')) {
      const member: MemberRow = {
        id: params[0] as string,
        organizationId: params[1] as string,
        userId: params[2] as string,
        role: (params[3] as string | undefined) ?? "member",
        createdAt: date,
      };
      const exists = state.members.some(
        (existing) => existing.userId === member.userId,
      );
      if (exists) return [];
      state.members.push(member);
      return [memberRow(member)];
    }

    if (query.startsWith('insert into "invitation"')) {
      const invitation: InvitationRow = {
        id: params[0] as string,
        organizationId: params[1] as string,
        email: params[2] as string,
        role: params[3] as string,
        status: params[4] as string,
        expiresAt: params[5] as Date,
        inviterId: params[6] as string,
        createdAt: date,
      };
      state.invitations.push(invitation);
      return [invitationRow(invitation)];
    }

    if (query.startsWith('update "invitation" set "status"')) {
      const status = params[0] as string;
      const invitationId = params[1] as string;
      const hasHouseholdFilter = query.includes(
        '"invitation"."organization_id"',
      );
      const householdId = hasHouseholdFilter
        ? (params[2] as string)
        : undefined;
      const pendingStatus = hasHouseholdFilter
        ? (params[3] as string | undefined)
        : (params[2] as string | undefined);
      const invitation = state.invitations.find(
        (candidate) =>
          candidate.id === invitationId &&
          (!householdId || candidate.organizationId === householdId) &&
          (!pendingStatus || candidate.status === pendingStatus),
      );
      if (!invitation) return [];
      invitation.status = status;
      return query.includes("returning") ? [invitationRow(invitation)] : [];
    }

    if (query.startsWith('delete from "member"')) {
      const memberId = params[0] as string;
      state.members = state.members.filter((member) => member.id !== memberId);
      return [];
    }

    if (query.startsWith('update "recipe"')) {
      if (
        query.includes('"recipe"."user_id"') &&
        query.includes('"recipe"."visibility"') &&
        !query.includes('"recipe"."id"')
      ) {
        const visibility = params[0] as RecipeRow["visibility"];
        const userId = params.at(-1) as string;
        for (const recipe of state.recipes) {
          if (recipe.visibility === "household" && recipe.userId === userId) {
            recipe.visibility = visibility;
            recipe.updatedAt = date;
          }
        }
        return [];
      }

      const recipeId = params.at(-2) as string;
      const userId = params.at(-1) as string;
      const recipe = state.recipes.find(
        (candidate) => candidate.id === recipeId && candidate.userId === userId,
      );
      if (!recipe) return [];
      recipe.visibility = params[0] as RecipeRow["visibility"];
      recipe.updatedAt = date;
      return [recipeRow(recipe)];
    }

    if (query.includes('from "organization"') && query.includes('"organization"."id"')) {
      const householdId = params[0] as string;
      return state.organizations
        .filter((organization) => organization.id === householdId)
        .map(organizationRow);
    }

    if (
      query.includes('from "member"') &&
      query.includes('inner join "organization"')
    ) {
      const userId = params[0] as string;
      return state.members
        .filter((member) => member.userId === userId)
        .map((member) => {
          const organization = state.organizations.find(
            (candidate) => candidate.id === member.organizationId,
          )!;
          return [
            organization.id,
            organization.name,
            organization.slug,
            organization.logo,
            organization.createdAt,
            organization.updatedAt,
            member.id,
            member.role,
          ];
        });
    }

    if (query.includes('from "member"') && query.includes('inner join "user"')) {
      const householdId = params[0] as string;
      return state.members
        .filter((member) => member.organizationId === householdId)
        .map((member) => {
          const user = state.users.find((candidate) => candidate.id === member.userId)!;
          return [
            member.id,
            member.organizationId,
            member.userId,
            member.role,
            member.createdAt,
            user.id,
            user.email,
            user.name,
            user.image,
          ];
        });
    }

    if (
      query.includes('from "member"') &&
      query.includes('"member"."organization_id"') &&
      query.includes('"member"."role"')
    ) {
      const householdId = params[0] as string;
      const role = params[1] as string;
      return state.members
        .filter(
          (member) =>
            member.organizationId === householdId && member.role === role,
        )
        .map(memberRow);
    }

    if (
      query.includes('from "member"') &&
      query.includes('"member"."id"') &&
      query.includes('"member"."organization_id"')
    ) {
      const memberId = params[0] as string;
      const householdId = params[1] as string;
      return state.members
        .filter(
          (member) =>
            member.id === memberId && member.organizationId === householdId,
        )
        .map(memberRow);
    }

    if (
      query.includes('from "member"') &&
      query.includes('"member"."organization_id"') &&
      query.includes('"member"."user_id"') &&
      params.length > 1
    ) {
      const householdId = params[0] as string;
      const userId = params[1] as string;
      return state.members
        .filter(
          (member) =>
            member.organizationId === householdId && member.userId === userId,
        )
        .map((member) => (query.includes('"member"."id"') ? [member.id] : memberRow(member)));
    }

    if (
      query.includes('from "member"') &&
      query.includes('"member"."organization_id"') &&
      params.length === 1
    ) {
      const householdId = params[0] as string;
      return state.members
        .filter((member) => member.organizationId === householdId)
        .map((member) => [member.userId]);
    }

    if (
      query.includes('from "member"') &&
      query.includes('"member"."user_id"')
    ) {
      const userId = params[0] as string;
      return state.members
        .filter((member) => member.userId === userId)
        .map(memberRow);
    }

    if (query.includes('from "invitation"') && query.includes('"invitation"."id"')) {
      const invitationId = params[0] as string;
      return state.invitations
        .filter((invitation) => invitation.id === invitationId)
        .map(invitationRow);
    }

    if (
      query.includes('from "invitation"') &&
      query.includes('"invitation"."email"')
    ) {
      const organizationId = params[0] as string;
      const email = params[1] as string;
      const status = params[2] as string;
      return state.invitations
        .filter(
          (invitation) =>
            invitation.organizationId === organizationId &&
            invitation.email === email &&
            invitation.status === status,
        )
        .map(invitationRow);
    }

    if (
      query.includes('from "recipe"') &&
      query.includes('"recipe"."slug"') &&
      query.includes('"recipe"."user_id"')
    ) {
      const slug = params[0] as string;
      const userId = params[1] as string;
      return state.recipes
        .filter((recipe) => recipe.slug === slug && recipe.userId === userId)
        .map(recipeRow);
    }

    if (query.includes('from "recipe"') && query.includes('"recipe"."slug"')) {
      const slug = params[0] as string;
      return state.recipes
        .filter((recipe) => recipe.slug === slug)
        .map(recipeRow);
    }

    if (query.includes('from "recipe"')) {
      const publicVisibility = params[0] as string | undefined;
      const ownerUserId = params[1] as string | undefined;
      const householdVisibilityIndex = params.indexOf("household");
      const householdUserIds =
        householdVisibilityIndex >= 0
          ? new Set(params.slice(householdVisibilityIndex + 1))
          : new Set();

      return state.recipes
        .filter(
          (recipe) =>
            recipe.visibility === publicVisibility ||
            recipe.userId === ownerUserId ||
            (recipe.visibility === "household" &&
              householdUserIds.has(recipe.userId)),
        )
        .map(recipeRow);
    }

    if (query.startsWith('insert into "verification"')) {
      return [params];
    }

    return [];
  }

  return { date, state, reset, queryRows };
});

vi.mock("../src/http/authorization", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/http/authorization")>();
  return {
    ...actual,
    loadBetterAuthSession: vi.fn(() => Promise.resolve(authzMock.session)),
  };
});

vi.mock("postgres", () => ({
  default: vi.fn(() => {
    // drizzle-orm/postgres-js/driver.js writes transparent parsers into
    // client.options.parsers / .serializers at construction time, so the mock
    // client must expose those empty objects. Queries go through:
    //   client.unsafe(sql, params).values() — SELECT (drizzle maps array-of-arrays)
    //   client.unsafe(sql, params)          — DML
    const queryResult = (rows: unknown[][] = []) =>
      Object.assign(Promise.resolve(rows), {
        values: () => Promise.resolve(rows),
      });
    const emptyResult = queryResult();
    const client = Object.assign(
      (_strings: TemplateStringsArray, ..._values: unknown[]) => emptyResult,
      {
        options: { parsers: {}, serializers: {} },
        unsafe: (query: string, params: unknown[] = []) => {
          const rows = dbMock.queryRows(query, params);
          return rows.length > 0 ? queryResult(rows) : emptyResult;
        },
        begin: <T>(transaction: (sql: unknown) => Promise<T>) =>
          transaction(client),
        end: (_options?: { timeout?: number }) => Promise.resolve(),
      },
    );
    return client;
  }),
}));

vi.mock("jose", () => ({
  createRemoteJWKSet: vi.fn(() => vi.fn()),
  jwtVerify: vi.fn(() => Promise.resolve({ payload: { sub: "tester" } })),
}));

import app from "../src/index";

function sessionFor(user: { id: string; email: string; name: string }) {
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: true,
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    },
    session: {
      id: `session-${user.id}`,
      token: `token-${user.id}`,
      userId: user.id,
      expiresAt: new Date("2027-01-02T00:00:00.000Z"),
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    },
  };
}

function seedHousehold() {
  dbMock.state.users.push(
    {
      id: "owner-user",
      name: "Owner",
      email: "owner@example.test",
      emailVerified: true,
      image: null,
      role: "user",
      banned: null,
      banReason: null,
      banExpires: null,
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    },
    {
      id: "member-user",
      name: "Member",
      email: "member@example.test",
      emailVerified: true,
      image: null,
      role: "user",
      banned: null,
      banReason: null,
      banExpires: null,
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    },
    {
      id: "outsider-user",
      name: "Outsider",
      email: "outsider@example.test",
      emailVerified: true,
      image: null,
      role: "user",
      banned: null,
      banReason: null,
      banExpires: null,
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    },
  );
  dbMock.state.organizations.push({
    id: "household-1",
    name: "Owner household",
    slug: "owner-household",
    logo: null,
    metadata: null,
    createdAt: dbMock.date,
    updatedAt: dbMock.date,
  });
  dbMock.state.members.push(
    {
      id: "owner-member",
      organizationId: "household-1",
      userId: "owner-user",
      role: "owner",
      createdAt: dbMock.date,
    },
    {
      id: "member-member",
      organizationId: "household-1",
      userId: "member-user",
      role: "member",
      createdAt: dbMock.date,
    },
  );
}

beforeEach(() => {
  authzMock.session = null;
  dbMock.reset();
});

const env = {
  DATABASE_URL: "postgresql://test:test@localhost/test",
  BETTER_AUTH_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "test-secret-that-is-at-least-thirty-two-characters",
  GOOGLE_CLIENT_ID: "google-client-id",
  GOOGLE_CLIENT_SECRET: "google-client-secret",
  GITHUB_CLIENT_ID: "github-client-id",
  GITHUB_CLIENT_SECRET: "github-client-secret",
};

describe("GET /health", () => {
  it("returns ok", async () => {
    const res = await app.request("/health", {}, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});

describe("GET /recipes", () => {
  it("returns recipes list", async () => {
    const res = await app.request("/recipes", {}, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("returns 503 when no connection is configured", async () => {
    const res = await app.request("/recipes", {}, { DATABASE_URL: "" });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: "No database connection configured (HYPERDRIVE or DATABASE_URL required)",
    });
  });

  it("returns 502 when database query fails", async () => {
    vi.mocked(postgres).mockReturnValueOnce(
      Object.assign(
        () => {},
        {
          options: { parsers: {}, serializers: {} },
          unsafe: () => ({
            values: () => Promise.reject(new Error("connection refused")),
          }),
          end: () => Promise.resolve(),
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ) as any,
    );

    const res = await app.request("/recipes", {}, env);
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Database query failed");
  });
});

describe("GET /recipes/:slug", () => {
  it("rejects malformed slugs before database access", async () => {
    const res = await app.request(
      "/recipes/Invalid%20Slug",
      {},
      { DATABASE_URL: "" },
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Invalid recipe slug",
      details: [
        {
          path: ["slug"],
          message:
            "Slug must use lowercase letters, numbers, and single hyphens between words",
        },
      ],
    });
  });

  it("allows household members to read household-shared recipes", async () => {
    seedHousehold();
    dbMock.state.recipes.push({
      id: "recipe-1",
      slug: "shared-soup",
      title: "Shared Soup",
      description: null,
      body: null,
      userId: "owner-user",
      visibility: "household",
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    });
    authzMock.session = sessionFor({
      id: "member-user",
      email: "member@example.test",
      name: "Member",
    });

    const res = await app.request("/recipes/shared-soup", {}, env);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      slug: "shared-soup",
      title: "Shared Soup",
      visibility: "household",
    });
  });

  it("returns 404 for anonymous household-shared recipe reads", async () => {
    seedHousehold();
    dbMock.state.recipes.push({
      id: "recipe-1",
      slug: "shared-soup",
      title: "Shared Soup",
      description: null,
      body: null,
      userId: "owner-user",
      visibility: "household",
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    });

    const res = await app.request("/recipes/shared-soup", {}, env);

    expect(res.status).toBe(404);
  });

  it("returns 404 for non-member household-shared recipe reads", async () => {
    seedHousehold();
    dbMock.state.recipes.push({
      id: "recipe-1",
      slug: "shared-soup",
      title: "Shared Soup",
      description: null,
      body: null,
      userId: "owner-user",
      visibility: "household",
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    });
    authzMock.session = sessionFor({
      id: "outsider-user",
      email: "outsider@example.test",
      name: "Outsider",
    });

    const res = await app.request("/recipes/shared-soup", {}, env);

    expect(res.status).toBe(404);
  });

  it("returns 404 when a stale household share points at a non-member owner", async () => {
    seedHousehold();
    dbMock.state.recipes.push({
      id: "recipe-1",
      slug: "stale-soup",
      title: "Stale Soup",
      description: null,
      body: null,
      userId: "outsider-user",
      visibility: "household",
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    });
    authzMock.session = sessionFor({
      id: "member-user",
      email: "member@example.test",
      name: "Member",
    });

    const res = await app.request("/recipes/stale-soup", {}, env);

    expect(res.status).toBe(404);
  });
});

describe("POST /recipes", () => {
  it("requires authentication", async () => {
    const res = await app.request(
      "/recipes",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          slug: "private-draft",
          title: "Private Draft",
        }),
      },
      env,
    );

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Authentication required" });
  });
});

describe("household membership flows", () => {
  it("requires authentication before creating a household", async () => {
    const res = await app.request(
      "/households",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ name: "Dinner Club" }),
      },
      env,
    );

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Authentication required" });
  });

  it("creates a household with the creator as owner", async () => {
    authzMock.session = sessionFor({
      id: "owner-user",
      email: "owner@example.test",
      name: "Owner",
    });

    const res = await app.request(
      "/households",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ name: "Dinner Club" }),
      },
      env,
    );

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ name: "Dinner Club" });
    expect(dbMock.state.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: "owner-user", role: "owner" }),
      ]),
    );
  });

  it("prevents a user from creating a second household", async () => {
    seedHousehold();
    authzMock.session = sessionFor({
      id: "member-user",
      email: "member@example.test",
      name: "Member",
    });

    const res = await app.request(
      "/households",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ name: "Second Household" }),
      },
      env,
    );

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "User already belongs to a household",
    });
  });

  it("lists household members for existing members", async () => {
    seedHousehold();
    authzMock.session = sessionFor({
      id: "member-user",
      email: "member@example.test",
      name: "Member",
    });

    const res = await app.request("/households/household-1/members", {}, env);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "owner-member",
          role: "owner",
          user: expect.objectContaining({ email: "owner@example.test" }),
        }),
        expect.objectContaining({
          id: "member-member",
          role: "member",
          user: expect.objectContaining({ email: "member@example.test" }),
        }),
      ]),
    );
  });

  it("returns 403 when non-members list household members", async () => {
    seedHousehold();
    authzMock.session = sessionFor({
      id: "outsider-user",
      email: "outsider@example.test",
      name: "Outsider",
    });

    const res = await app.request("/households/household-1/members", {}, env);

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Authorization required" });
  });

  it("allows owners to invite household members", async () => {
    seedHousehold();
    authzMock.session = sessionFor({
      id: "owner-user",
      email: "owner@example.test",
      name: "Owner",
    });

    const res = await app.request(
      "/households/household-1/invitations",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ email: "NewMember@Example.test" }),
      },
      env,
    );

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      householdId: "household-1",
      email: "newmember@example.test",
      role: "member",
      status: "pending",
    });
  });

  it("returns 429 once the owner exceeds the invite rate limit", async () => {
    seedHousehold();
    // Pre-fill the per-account window to its cap so the next invite trips it.
    dbMock.state.rateLimitCounts.set("household-invite:owner-user", 10);
    authzMock.session = sessionFor({
      id: "owner-user",
      email: "owner@example.test",
      name: "Owner",
    });

    const res = await app.request(
      "/households/household-1/invitations",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ email: "newmember@example.test" }),
      },
      env,
    );

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBeTruthy();
    expect(await res.json()).toMatchObject({ error: "Too many requests" });
    // The invitation is rejected before any row is written.
    expect(dbMock.state.invitations).toHaveLength(0);
  });

  it("returns 409 when a pending invitation already exists for the email", async () => {
    seedHousehold();
    dbMock.state.invitations.push({
      id: "invitation-1",
      organizationId: "household-1",
      email: "newmember@example.test",
      role: "member",
      status: "pending",
      expiresAt: new Date("2027-01-02T00:00:00.000Z"),
      inviterId: "owner-user",
      createdAt: dbMock.date,
    });
    authzMock.session = sessionFor({
      id: "owner-user",
      email: "owner@example.test",
      name: "Owner",
    });

    const res = await app.request(
      "/households/household-1/invitations",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ email: "NewMember@Example.test" }),
      },
      env,
    );

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "A pending invitation already exists for this email",
    });
    expect(dbMock.state.invitations).toHaveLength(1);
  });

  it("returns 403 when non-owners invite household members", async () => {
    seedHousehold();
    authzMock.session = sessionFor({
      id: "member-user",
      email: "member@example.test",
      name: "Member",
    });

    const res = await app.request(
      "/households/household-1/invitations",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ email: "newmember@example.test" }),
      },
      env,
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Authorization required" });
  });

  it("allows invited users to accept invitations", async () => {
    seedHousehold();
    dbMock.state.invitations.push({
      id: "invitation-1",
      organizationId: "household-1",
      email: "outsider@example.test",
      role: "member",
      status: "pending",
      expiresAt: new Date("2027-01-02T00:00:00.000Z"),
      inviterId: "owner-user",
      createdAt: dbMock.date,
    });
    authzMock.session = sessionFor({
      id: "outsider-user",
      email: "outsider@example.test",
      name: "Outsider",
    });

    const res = await app.request(
      "/households/invitations/invitation-1/accept",
      {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      invitation: { id: "invitation-1", status: "accepted" },
      membershipCreated: true,
    });
    expect(dbMock.state.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          organizationId: "household-1",
          userId: "outsider-user",
          role: "member",
        }),
      ]),
    );
  });

  it("returns 403 when a different user accepts an invitation", async () => {
    seedHousehold();
    dbMock.state.invitations.push({
      id: "invitation-1",
      organizationId: "household-1",
      email: "member@example.test",
      role: "member",
      status: "pending",
      expiresAt: new Date("2027-01-02T00:00:00.000Z"),
      inviterId: "owner-user",
      createdAt: dbMock.date,
    });
    authzMock.session = sessionFor({
      id: "outsider-user",
      email: "outsider@example.test",
      name: "Outsider",
    });

    const res = await app.request(
      "/households/invitations/invitation-1/accept",
      {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
      },
      env,
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Authorization required" });
  });

  it("prevents a user from accepting an invite while already in a household", async () => {
    seedHousehold();
    dbMock.state.invitations.push({
      id: "invitation-1",
      organizationId: "other-household",
      email: "member@example.test",
      role: "member",
      status: "pending",
      expiresAt: new Date("2027-01-02T00:00:00.000Z"),
      inviterId: "owner-user",
      createdAt: dbMock.date,
    });
    authzMock.session = sessionFor({
      id: "member-user",
      email: "member@example.test",
      name: "Member",
    });

    const res = await app.request(
      "/households/invitations/invitation-1/accept",
      {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
      },
      env,
    );

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "User already belongs to a household",
    });
  });

  it("allows invited users to decline invitations", async () => {
    seedHousehold();
    dbMock.state.invitations.push({
      id: "invitation-1",
      organizationId: "household-1",
      email: "member@example.test",
      role: "member",
      status: "pending",
      expiresAt: new Date("2027-01-02T00:00:00.000Z"),
      inviterId: "owner-user",
      createdAt: dbMock.date,
    });
    authzMock.session = sessionFor({
      id: "member-user",
      email: "member@example.test",
      name: "Member",
    });

    const res = await app.request(
      "/households/invitations/invitation-1/decline",
      {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      id: "invitation-1",
      status: "rejected",
    });
  });

  it("prevents declining finalized invitations", async () => {
    seedHousehold();
    dbMock.state.invitations.push({
      id: "invitation-1",
      organizationId: "household-1",
      email: "member@example.test",
      role: "member",
      status: "accepted",
      expiresAt: new Date("2027-01-02T00:00:00.000Z"),
      inviterId: "owner-user",
      createdAt: dbMock.date,
    });
    authzMock.session = sessionFor({
      id: "member-user",
      email: "member@example.test",
      name: "Member",
    });

    const res = await app.request(
      "/households/invitations/invitation-1/decline",
      {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
      },
      env,
    );

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "Invitation is not pending",
    });
  });

  it("allows owners to revoke pending invitations", async () => {
    seedHousehold();
    dbMock.state.invitations.push({
      id: "invitation-1",
      organizationId: "household-1",
      email: "outsider@example.test",
      role: "member",
      status: "pending",
      expiresAt: new Date("2027-01-02T00:00:00.000Z"),
      inviterId: "owner-user",
      createdAt: dbMock.date,
    });
    authzMock.session = sessionFor({
      id: "owner-user",
      email: "owner@example.test",
      name: "Owner",
    });

    const res = await app.request(
      "/households/household-1/invitations/invitation-1",
      {
        method: "DELETE",
        headers: { origin: "http://localhost:3000" },
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      id: "invitation-1",
      status: "canceled",
    });
  });

  it("prevents owners from revoking finalized invitations", async () => {
    seedHousehold();
    dbMock.state.invitations.push({
      id: "invitation-1",
      organizationId: "household-1",
      email: "outsider@example.test",
      role: "member",
      status: "accepted",
      expiresAt: new Date("2027-01-02T00:00:00.000Z"),
      inviterId: "owner-user",
      createdAt: dbMock.date,
    });
    authzMock.session = sessionFor({
      id: "owner-user",
      email: "owner@example.test",
      name: "Owner",
    });

    const res = await app.request(
      "/households/household-1/invitations/invitation-1",
      {
        method: "DELETE",
        headers: { origin: "http://localhost:3000" },
      },
      env,
    );

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "Invitation is not pending",
    });
  });

  it("allows owners to revoke members", async () => {
    seedHousehold();
    dbMock.state.recipes.push({
      id: "recipe-1",
      slug: "member-soup",
      title: "Member Soup",
      description: null,
      body: null,
      userId: "member-user",
      visibility: "household",
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    });
    authzMock.session = sessionFor({
      id: "owner-user",
      email: "owner@example.test",
      name: "Owner",
    });

    const res = await app.request(
      "/households/household-1/members/member-member",
      {
        method: "DELETE",
        headers: { origin: "http://localhost:3000" },
      },
      env,
    );

    expect(res.status).toBe(204);
    expect(dbMock.state.members).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "member-member" })]),
    );
    expect(dbMock.state.recipes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: "member-soup",
          visibility: "private",
        }),
      ]),
    );
  });

  it("allows members to leave voluntarily", async () => {
    seedHousehold();
    dbMock.state.recipes.push({
      id: "recipe-1",
      slug: "member-soup",
      title: "Member Soup",
      description: null,
      body: null,
      userId: "member-user",
      visibility: "household",
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    });
    authzMock.session = sessionFor({
      id: "member-user",
      email: "member@example.test",
      name: "Member",
    });

    const res = await app.request(
      "/households/household-1/leave",
      {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
      },
      env,
    );

    expect(res.status).toBe(204);
    expect(dbMock.state.members).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "member-member" })]),
    );
    expect(dbMock.state.recipes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: "member-soup",
          visibility: "private",
        }),
      ]),
    );
  });

  it("returns 404 when leaving a missing household", async () => {
    seedHousehold();
    authzMock.session = sessionFor({
      id: "member-user",
      email: "member@example.test",
      name: "Member",
    });

    const res = await app.request(
      "/households/missing-household/leave",
      {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
      },
      env,
    );

    expect(res.status).toBe(404);
  });
});

describe("household recipe sharing", () => {
  it("allows recipe owners to share and unshare with their household", async () => {
    seedHousehold();
    dbMock.state.recipes.push({
      id: "recipe-1",
      slug: "private-soup",
      title: "Private Soup",
      description: null,
      body: null,
      userId: "owner-user",
      visibility: "private",
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    });
    authzMock.session = sessionFor({
      id: "owner-user",
      email: "owner@example.test",
      name: "Owner",
    });

    const shareRes = await app.request(
      "/recipes/private-soup/household-share",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
      },
      env,
    );

    expect(shareRes.status).toBe(200);
    expect(await shareRes.json()).toMatchObject({
      slug: "private-soup",
      visibility: "household",
    });

    const unshareRes = await app.request(
      "/recipes/private-soup/household-share",
      {
        method: "DELETE",
        headers: { origin: "http://localhost:3000" },
      },
      env,
    );

    expect(unshareRes.status).toBe(200);
    expect(await unshareRes.json()).toMatchObject({
      slug: "private-soup",
      visibility: "private",
    });
  });

  it("allows household members to share their own recipes", async () => {
    seedHousehold();
    dbMock.state.recipes.push({
      id: "recipe-1",
      slug: "member-soup",
      title: "Member Soup",
      description: null,
      body: null,
      userId: "member-user",
      visibility: "private",
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    });
    authzMock.session = sessionFor({
      id: "member-user",
      email: "member@example.test",
      name: "Member",
    });

    const res = await app.request(
      "/recipes/member-soup/household-share",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      slug: "member-soup",
      visibility: "household",
    });
  });

  it("returns 403 when a non-member shares to a household", async () => {
    seedHousehold();
    dbMock.state.recipes.push({
      id: "recipe-1",
      slug: "outsider-soup",
      title: "Outsider Soup",
      description: null,
      body: null,
      userId: "outsider-user",
      visibility: "private",
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    });
    authzMock.session = sessionFor({
      id: "outsider-user",
      email: "outsider@example.test",
      name: "Outsider",
    });

    const res = await app.request(
      "/recipes/outsider-soup/household-share",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
      },
      env,
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Authorization required" });
  });
});

describe("PATCH /recipes/:slug", () => {
  it("rejects malformed slugs before authentication or database access", async () => {
    const res = await app.request(
      "/recipes/-invalid",
      { method: "PATCH" },
      { DATABASE_URL: "" },
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Invalid recipe slug",
      details: [
        {
          path: ["slug"],
          message:
            "Slug must use lowercase letters, numbers, and single hyphens between words",
        },
      ],
    });
  });
});

describe("POST /api/auth/sign-in/social", () => {
  it.each(["google", "github"] as const)(
    "uses the public frontend callback for %s",
    async (provider) => {
      const res = await app.request(
        "/api/auth/sign-in/social",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "http://localhost:3000",
          },
          body: JSON.stringify({
            provider,
            callbackURL: "/recipes",
            disableRedirect: true,
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { url: string };
      const providerURL = new URL(body.url);
      expect(providerURL.searchParams.get("redirect_uri")).toBe(
        `http://localhost:3000/api/auth/callback/${provider}`,
      );
    },
  );

  it("returns 503 when the public auth URL is missing", async () => {
    const res = await app.request(
      "/api/auth/sign-in/social",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: "google" }),
      },
      { ...env, BETTER_AUTH_URL: "" },
    );

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: "Auth configuration is incomplete",
    });
  });

  it("returns 503 when the public auth URL is malformed", async () => {
    const res = await app.request(
      "/api/auth/sign-in/social",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: "google" }),
      },
      { ...env, BETTER_AUTH_URL: "not-a-valid-url" },
    );

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: "Auth configuration is invalid",
    });
  });

  it("rejects unsafe browser mutations without a trusted CSRF signal", async () => {
    const res = await app.request(
      "/api/auth/sign-in/social",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: "google" }),
      },
      env,
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: "CSRF validation failed",
      details: [
        {
          path: [],
          message: "Unsafe browser mutations must come from a trusted origin",
        },
      ],
    });
  });

  it("rejects same-site fetch metadata without a trusted origin", async () => {
    const res = await app.request(
      "/api/auth/sign-in/social",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "sec-fetch-site": "same-site",
        },
        body: JSON.stringify({ provider: "google" }),
      },
      env,
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: "CSRF validation failed",
      details: [
        {
          path: [],
          message: "Unsafe browser mutations must come from a trusted origin",
        },
      ],
    });
  });

  it("rejects same-origin fetch metadata without a trusted origin", async () => {
    const res = await app.request(
      "/api/auth/sign-in/social",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "sec-fetch-site": "same-origin",
        },
        body: JSON.stringify({ provider: "google" }),
      },
      env,
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: "CSRF validation failed",
      details: [
        {
          path: [],
          message: "Unsafe browser mutations must come from a trusted origin",
        },
      ],
    });
  });

  it("does not expose raw Better Auth organization endpoints", async () => {
    const res = await app.request(
      "/api/auth/organization/create",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ name: "Bypass", slug: "bypass" }),
      },
      env,
    );

    expect(res.status).toBe(404);
  });
});

describe("preview authentication", () => {
  const previewEnv = {
    DATABASE_URL: env.DATABASE_URL,
    DEPLOYMENT_ENV: "preview",
    BETTER_AUTH_URL: "https://pr-42.personal-site-bu5.pages.dev",
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
    PREVIEW_AUTH_PASSWORD: "a-long-random-preview-password",
    CF_ACCESS_TEAM_DOMAIN: "example.cloudflareaccess.com",
    CF_ACCESS_AUD: "preview-audience",
  };

  it("is unavailable outside preview deployments", async () => {
    const res = await app.request(
      "/api/auth/preview/scenarios",
      {},
      env,
    );
    expect(res.status).toBe(404);
  });

  it("requires complete preview configuration", async () => {
    const res = await app.request(
      "/api/auth/preview/scenarios",
      {},
      { ...previewEnv, CF_ACCESS_AUD: "" },
    );
    expect(res.status).toBe(503);
  });

  it("requires a valid Cloudflare Access assertion", async () => {
    const res = await app.request(
      "/api/auth/preview/scenarios",
      {},
      previewEnv,
    );
    expect(res.status).toBe(403);
  });

  it("returns the allowlisted scenarios after Access authorization", async () => {
    const res = await app.request(
      "/api/auth/preview/scenarios",
      { headers: { "cf-access-jwt-assertion": "test-assertion" } },
      previewEnv,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "empty-user" }),
        expect.objectContaining({ id: "user-with-recipes" }),
        expect.objectContaining({ id: "admin-user" }),
      ]),
    );
  });

  it("rejects scenario identifiers that are not allowlisted", async () => {
    const res = await app.request(
      "/api/auth/preview/sign-in",
      {
        method: "POST",
        headers: {
          "cf-access-jwt-assertion": "test-assertion",
          "content-type": "application/json",
          origin: previewEnv.BETTER_AUTH_URL,
        },
        body: JSON.stringify({ scenario: "arbitrary-user" }),
      },
      previewEnv,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Unknown preview scenario" });
  });

  it("returns structured validation errors for malformed preview sign-in bodies", async () => {
    const res = await app.request(
      "/api/auth/preview/sign-in",
      {
        method: "POST",
        headers: {
          "cf-access-jwt-assertion": "test-assertion",
          "content-type": "application/json",
          origin: previewEnv.BETTER_AUTH_URL,
        },
        body: JSON.stringify({ scenario: "" }),
      },
      previewEnv,
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Invalid request body",
      details: [
        {
          path: ["scenario"],
          message: expect.any(String),
        },
      ],
    });
  });

  it("returns structured errors for invalid preview sign-in JSON", async () => {
    const res = await app.request(
      "/api/auth/preview/sign-in",
      {
        method: "POST",
        headers: {
          "cf-access-jwt-assertion": "test-assertion",
          "content-type": "application/json",
          origin: previewEnv.BETTER_AUTH_URL,
        },
        body: "{not-json",
      },
      previewEnv,
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Invalid JSON",
      details: [
        {
          path: [],
          message: "Request body must be valid JSON",
        },
      ],
    });
  });

  it("returns unsupported media type for non-JSON preview sign-in bodies", async () => {
    const res = await app.request(
      "/api/auth/preview/sign-in",
      {
        method: "POST",
        headers: {
          "cf-access-jwt-assertion": "test-assertion",
          "content-type": "text/plain",
          origin: previewEnv.BETTER_AUTH_URL,
        },
        body: "empty-user",
      },
      previewEnv,
    );

    expect(res.status).toBe(415);
    expect(await res.json()).toEqual({
      error: "Unsupported media type",
      details: [
        {
          path: [],
          message: "Request body must use application/json",
        },
      ],
    });
  });

  it("rejects preview sign-in without a trusted CSRF signal", async () => {
    const res = await app.request(
      "/api/auth/preview/sign-in",
      {
        method: "POST",
        headers: {
          "cf-access-jwt-assertion": "test-assertion",
          "content-type": "application/json",
        },
        body: JSON.stringify({ scenario: "empty-user" }),
      },
      previewEnv,
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: "CSRF validation failed",
      details: [
        {
          path: [],
          message: "Unsafe browser mutations must come from a trusted origin",
        },
      ],
    });
  });

  it("does not expose Better Auth's raw password endpoints", async () => {
    for (const path of [
      "/api/auth/sign-in/email",
      "/api/auth/sign-in/email/",
      "/api/auth/sign-up/email",
      "/api/auth/sign-up/email/",
    ]) {
      const res = await app.request(path, { method: "POST" }, previewEnv);
      expect(res.status).toBe(404);
    }
  });
});

describe("unknown routes", () => {
  it("returns 404", async () => {
    const res = await app.request("/unknown", {}, env);
    expect(res.status).toBe(404);
  });
});
