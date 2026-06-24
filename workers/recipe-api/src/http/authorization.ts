import type { Context, MiddlewareHandler } from "hono";
import { createAuth, type Auth } from "../auth";
import type { createDb } from "../db";

type AuthorizationEnv = Parameters<typeof createAuth>[1];
type Db = ReturnType<typeof createDb>["db"];

export type AuthenticatedSession = NonNullable<
  Awaited<ReturnType<Auth["api"]["getSession"]>>
>;
export type AuthenticatedUser = AuthenticatedSession["user"];

export type AuthorizationVariables = {
  authSession: AuthenticatedSession;
  authUser: AuthenticatedUser;
};

export type AuthorizationDecision =
  | { allowed: true }
  | { allowed: false; status: 401 | 403; error: string };
export type AuthorizationFailure = Extract<
  AuthorizationDecision,
  { allowed: false }
>;

export type RecipeVisibility = "public" | "private" | "household";

export type OwnedResource = {
  userId: string;
};

export type RecipeResource = OwnedResource & {
  visibility: RecipeVisibility;
};

export type HouseholdResource = {
  ownerId: string;
};

export type HouseholdReadContext = {
  isHouseholdMemberOfOwner: boolean;
};

export type AuthSessionLoader = (
  c: Context<{ Variables: Partial<AuthorizationVariables> }>,
) => Promise<AuthenticatedSession | null>;

const noHouseholdReadAccess: HouseholdReadContext = {
  isHouseholdMemberOfOwner: false,
};

function hasSessionSignal(c: Context): boolean {
  return Boolean(c.req.header("cookie") || c.req.header("authorization"));
}

export function allow(): AuthorizationDecision {
  return { allowed: true };
}

export function unauthenticated(): AuthorizationFailure {
  return {
    allowed: false,
    status: 401,
    error: "Authentication required",
  };
}

export function forbidden(): AuthorizationFailure {
  return {
    allowed: false,
    status: 403,
    error: "Authorization required",
  };
}

export function authorizationResponse(
  c: Context,
  decision: AuthorizationFailure,
): Response {
  return c.json({ error: decision.error }, decision.status);
}

export async function loadBetterAuthSession(
  c: Context<{
    Bindings: AuthorizationEnv;
    Variables: Partial<AuthorizationVariables>;
  }>,
  db: Db,
): Promise<AuthenticatedSession | null> {
  if (!hasSessionSignal(c)) return null;
  const auth = createAuth(db, c.env);
  return auth.api.getSession({
    headers: c.req.raw.headers,
    query: { disableCookieCache: true },
  });
}

export function requireAuthenticatedUser(
  loadSession: AuthSessionLoader,
): MiddlewareHandler<{ Variables: Partial<AuthorizationVariables> }> {
  return async (c, next) => {
    const session = await loadSession(c);
    if (!session) return authorizationResponse(c, unauthenticated());

    c.set("authSession", session);
    c.set("authUser", session.user);
    await next();
  };
}

export function requireAuthorization(
  loadSession: AuthSessionLoader,
  authorize: (
    session: AuthenticatedSession | null,
    c: Context<{ Variables: Partial<AuthorizationVariables> }>,
  ) => AuthorizationDecision | Promise<AuthorizationDecision>,
): MiddlewareHandler<{ Variables: Partial<AuthorizationVariables> }> {
  return async (c, next) => {
    const session = await loadSession(c);
    if (session) {
      c.set("authSession", session);
      c.set("authUser", session.user);
    }

    const decision = await authorize(session, c);
    if (!decision.allowed) return authorizationResponse(c, decision);
    await next();
  };
}

export function authorizeOwnerOnly(
  user: AuthenticatedUser | null | undefined,
  resource: OwnedResource,
): AuthorizationDecision {
  if (!user) return unauthenticated();
  return resource.userId === user.id ? allow() : forbidden();
}

export function authorizeRecipeRead(
  user: AuthenticatedUser | null | undefined,
  recipe: RecipeResource,
  household: HouseholdReadContext = noHouseholdReadAccess,
): AuthorizationDecision {
  if (recipe.visibility === "public") return allow();
  if (!user) return unauthenticated();
  if (recipe.userId === user.id) return allow();
  if (
    recipe.visibility === "household" &&
    household.isHouseholdMemberOfOwner
  ) {
    return allow();
  }
  return forbidden();
}

export function authorizeHouseholdMembershipManagement(
  user: AuthenticatedUser | null | undefined,
  household: HouseholdResource,
): AuthorizationDecision {
  if (!user) return unauthenticated();
  return household.ownerId === user.id ? allow() : forbidden();
}
