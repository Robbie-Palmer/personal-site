import { sql } from "drizzle-orm";
import type { Context } from "hono";
import type { Db } from "recipe-db";
import { appRateLimit } from "recipe-db/schema";

export type RateLimitRule = {
  max: number;
  windowSeconds: number;
};

export type RateLimitResult = {
  allowed: boolean;
  retryAfter: number;
};

// One INSERT ... ON CONFLICT keeps the check and increment atomic. Fails open so
// a counter outage never blocks legitimate traffic.
export async function enforceRateLimit(
  db: Db,
  key: string,
  rule: RateLimitRule,
): Promise<RateLimitResult> {
  const now = new Date();
  const windowExpiry = new Date(now.getTime() - rule.windowSeconds * 1000);
  // Values interpolated into raw SQL do not inherit the column encoder. Bind
  // these Dates through the timestamp column so postgres.js receives strings
  // rather than raw Date objects.
  const encodedNow = sql.param(now, appRateLimit.windowStart);
  const encodedWindowExpiry = sql.param(
    windowExpiry,
    appRateLimit.windowStart,
  );

  try {
    const [row] = await db
      .insert(appRateLimit)
      .values({ key, count: 1, windowStart: now })
      .onConflictDoUpdate({
        target: appRateLimit.key,
        set: {
          count: sql`case when ${appRateLimit.windowStart} <= ${encodedWindowExpiry} then 1 else ${appRateLimit.count} + 1 end`,
          windowStart: sql`case when ${appRateLimit.windowStart} <= ${encodedWindowExpiry} then ${encodedNow} else ${appRateLimit.windowStart} end`,
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

export function rateLimitedResponse(c: Context, retryAfter: number): Response {
  return c.json(
    {
      error: "Too many requests",
      details: [
        { path: [], message: "Rate limit exceeded. Please retry later." },
      ],
    },
    429,
    { "Retry-After": String(retryAfter) },
  );
}
