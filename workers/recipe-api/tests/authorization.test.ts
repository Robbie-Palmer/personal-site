import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import {
  type AuthenticatedSession,
  authorizeHouseholdMembershipManagement,
  authorizeOwnerOnly,
  authorizeRecipeRead,
  forbidden,
  requireAuthorization,
  requireAuthenticatedUser,
} from "../src/http/authorization";

const ownerSession = {
  user: {
    id: "user-owner",
    email: "owner@example.test",
    name: "Owner",
    emailVerified: true,
    banned: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
  session: {
    id: "session-owner",
    token: "token-owner",
    userId: "user-owner",
    expiresAt: new Date("2026-01-02T00:00:00.000Z"),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
} satisfies AuthenticatedSession;

describe("authorization policies", () => {
  it("allows public recipe reads without a user", () => {
    expect(
      authorizeRecipeRead(undefined, {
        userId: "recipe-owner",
        visibility: "public",
      }),
    ).toEqual({ allowed: true });
  });

  it("requires authentication before private or household recipe reads", () => {
    expect(
      authorizeRecipeRead(undefined, {
        userId: "recipe-owner",
        visibility: "private",
      }),
    ).toEqual({
      allowed: false,
      status: 401,
      error: "Authentication required",
    });

    expect(
      authorizeRecipeRead(undefined, {
        userId: "recipe-owner",
        visibility: "household",
      }),
    ).toEqual({
      allowed: false,
      status: 401,
      error: "Authentication required",
    });
  });

  it("allows owner-only resource access only to the resource owner", () => {
    expect(
      authorizeOwnerOnly(ownerSession.user, { userId: "user-owner" }),
    ).toEqual({ allowed: true });
    expect(
      authorizeOwnerOnly(ownerSession.user, { userId: "someone-else" }),
    ).toEqual({
      allowed: false,
      status: 403,
      error: "Authorization required",
    });
  });

  it("allows household-shared recipe reads for household members", () => {
    expect(
      authorizeRecipeRead(
        ownerSession.user,
        {
          userId: "someone-else",
          visibility: "household",
        },
        { isHouseholdMemberOfOwner: true },
      ),
    ).toEqual({ allowed: true });
  });

  it("keeps household membership management owner-only", () => {
    expect(
      authorizeHouseholdMembershipManagement(ownerSession.user, {
        ownerId: "user-owner",
      }),
    ).toEqual({ allowed: true });
    expect(
      authorizeHouseholdMembershipManagement(ownerSession.user, {
        ownerId: "someone-else",
      }),
    ).toEqual({
      allowed: false,
      status: 403,
      error: "Authorization required",
    });
  });
});

describe("authorization middleware", () => {
  it("returns 401 when a privileged route has no authenticated session", async () => {
    const app = new Hono();
    app.use(
      "/protected",
      requireAuthenticatedUser(async () => null),
    );
    app.get("/protected", (c) => c.json({ ok: true }));

    const res = await app.request("/protected");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Authentication required" });
  });

  it("returns 403 when an authenticated user is not authorized", async () => {
    const app = new Hono();
    app.use(
      "/owner-only",
      requireAuthorization(
        async () => ownerSession,
        () => forbidden(),
      ),
    );
    app.get("/owner-only", (c) => c.json({ ok: true }));

    const res = await app.request("/owner-only");
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Authorization required" });
  });
});
