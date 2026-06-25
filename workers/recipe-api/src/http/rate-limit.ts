import { sql } from "drizzle-orm";
import type { Context } from "hono";
import type { createDb } from "../db";
import { appRateLimit } from "../db/schema";

type Db = ReturnType<typeof createDb>["db"];

export type RateLimitRule = {
  /** Maximum number of requests permitted within the window. */
  max: number;
  /** Length of the fixed window, in seconds. */
  windowSeconds: number;
};

export type RateLimitResult = {
  allowed: boolean;
  /** Seconds to wait before retrying. Only meaningful when `allowed` is false. */
  retryAfter: number;
};

// Per-account write limits. ADR 035 calls out household invites as a
// write-heavy, per-account path that needs abuse protection from day one.
export const HOUSEHOLD_INVITE_RATE_LIMIT: RateLimitRule = {
  max: 10,
  windowSeconds: 60 * 60,
};

/**
 * Strongly consistent fixed-window rate limiter backed by Postgres.
 *
 * The check-and-increment runs as a single `INSERT ... ON CONFLICT DO UPDATE`
 * statement, so concurrent requests cannot bypass the limit by racing a stale
 * read — the gap an eventually consistent store like Cloudflare KV would leave
 * open (ADR 035, ADR 033).
 *
 * Fails open: if the counter store errors we allow the request rather than
 * block legitimate writes. The Cloudflare edge rule and Better Auth limiter
 * remain as additional layers.
 */
export async function enforceRateLimit(
  db: Db,
  key: string,
  rule: RateLimitRule,
): Promise<RateLimitResult> {
  const now = new Date();
  const windowExpiry = new Date(now.getTime() - rule.windowSeconds * 1000);

  try {
    const [row] = await db
      .insert(appRateLimit)
      .values({ key, count: 1, windowStart: now })
      .onConflictDoUpdate({
        target: appRateLimit.key,
        // When the stored window has elapsed, start a fresh one; otherwise add
        // to the running count. Both branches run inside the single statement.
        set: {
          count: sql`case when ${appRateLimit.windowStart} <= ${windowExpiry} then 1 else ${appRateLimit.count} + 1 end`,
          windowStart: sql`case when ${appRateLimit.windowStart} <= ${windowExpiry} then ${now} else ${appRateLimit.windowStart} end`,
        },
      })
      .returning({
        count: appRateLimit.count,
        windowStart: appRateLimit.windowStart,
      });

    if (!row || row.count <= rule.max) {
      return { allowed: true, retryAfter: 0 };
    }

    const resetAt = row.windowStart.getTime() + rule.windowSeconds * 1000;
    const retryAfter = Math.max(1, Math.ceil((resetAt - now.getTime()) / 1000));
    return { allowed: false, retryAfter };
  } catch (error) {
    console.error("Rate limit check failed; allowing request", error);
    return { allowed: true, retryAfter: 0 };
  }
}

/**
 * 429 response with a `Retry-After` header, matching the JSON error shape the
 * rest of the API uses for client errors.
 */
export function rateLimitedResponse(c: Context, retryAfter: number): Response {
  c.header("Retry-After", String(retryAfter));
  return c.json(
    {
      error: "Too many requests",
      details: [
        {
          path: [],
          message: "Rate limit exceeded. Please retry later.",
        },
      ],
    },
    429,
  );
}

type BetterAuthRule = { window: number; max: number };
type BetterAuthRateLimit = { key: string; count: number; lastRequest: number };

/**
 * Adapts {@link enforceRateLimit} to Better Auth's rate-limit storage contract
 * so its built-in limiter runs on strongly consistent Postgres instead of KV
 * (ADR 035). Better Auth uses `consume` exclusively when present; `get`/`set`
 * satisfy the interface and act as a non-atomic fallback.
 */
export function createAuthRateLimitStorage(db: Db) {
  const consume = async (key: string, rule: BetterAuthRule) => {
    const result = await enforceRateLimit(db, `auth:${key}`, {
      max: rule.max,
      windowSeconds: rule.window,
    });
    return {
      allowed: result.allowed,
      retryAfter: result.allowed ? null : result.retryAfter,
    };
  };

  return {
    consume,
    get: async (key: string): Promise<BetterAuthRateLimit | undefined> => {
      const [row] = await db
        .select({
          count: appRateLimit.count,
          windowStart: appRateLimit.windowStart,
        })
        .from(appRateLimit)
        .where(sql`${appRateLimit.key} = ${`auth:${key}`}`)
        .limit(1);
      if (!row) return undefined;
      return { key, count: row.count, lastRequest: row.windowStart.getTime() };
    },
    set: async (
      key: string,
      value: BetterAuthRateLimit,
      _update?: boolean,
    ): Promise<void> => {
      const namespaced = `auth:${key}`;
      await db
        .insert(appRateLimit)
        .values({
          key: namespaced,
          count: value.count,
          windowStart: new Date(value.lastRequest),
        })
        .onConflictDoUpdate({
          target: appRateLimit.key,
          set: {
            count: value.count,
            windowStart: new Date(value.lastRequest),
          },
        });
    },
  };
}
