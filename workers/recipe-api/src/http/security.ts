import type { Context } from "hono";

type SecurityEnv = {
  BETTER_AUTH_URL?: string;
};

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function originFrom(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

function trustedOrigins(c: Context): Set<string> {
  const origins = new Set<string>([new URL(c.req.url).origin]);
  const authOrigin = originFrom((c.env as SecurityEnv).BETTER_AUTH_URL);
  if (authOrigin) origins.add(authOrigin);
  return origins;
}

function hasTrustedOrigin(c: Context): boolean {
  const origin = c.req.header("origin");
  return Boolean(origin && trustedOrigins(c).has(origin));
}

export function isUnsafeMutation(method: string): boolean {
  return unsafeMethods.has(method.toUpperCase());
}

export function hasValidCsrfSignal(c: Context): boolean {
  return hasTrustedOrigin(c);
}

export function validateCsrf(c: Context): Response | undefined {
  if (!isUnsafeMutation(c.req.method) || hasValidCsrfSignal(c)) return undefined;
  return c.json(
    {
      error: "CSRF validation failed",
      details: [
        {
          path: [],
          message: "Unsafe browser mutations must come from a trusted origin",
        },
      ],
    },
    403,
  );
}
