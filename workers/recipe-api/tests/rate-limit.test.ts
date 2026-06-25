import { describe, expect, it, vi } from "vitest";
import {
  createAuthRateLimitStorage,
  enforceRateLimit,
} from "../src/http/rate-limit";

type ReturnRow = { count: number; windowStart: Date };

/**
 * Minimal stand-in for the drizzle db that records the upsert and returns a
 * caller-supplied row, mirroring `INSERT ... ON CONFLICT ... RETURNING`.
 */
function fakeDb(rows: ReturnRow[] | (() => never)) {
  const returning = vi.fn(() =>
    typeof rows === "function" ? rows() : Promise.resolve(rows),
  );
  const onConflictDoUpdate = vi.fn(() => ({ returning }));
  const values = vi.fn(() => ({ onConflictDoUpdate }));
  const insert = vi.fn(() => ({ values }));
  return { db: { insert } as never, insert, values, onConflictDoUpdate };
}

describe("enforceRateLimit", () => {
  it("allows requests within the window", async () => {
    const { db, insert } = fakeDb([{ count: 1, windowStart: new Date() }]);

    const result = await enforceRateLimit(db, "k", {
      max: 10,
      windowSeconds: 3600,
    });

    expect(result).toEqual({ allowed: true, retryAfter: 0 });
    expect(insert).toHaveBeenCalledOnce();
  });

  it("allows the request exactly on the limit", async () => {
    const { db } = fakeDb([{ count: 10, windowStart: new Date() }]);

    const result = await enforceRateLimit(db, "k", {
      max: 10,
      windowSeconds: 3600,
    });

    expect(result.allowed).toBe(true);
  });

  it("blocks once the count exceeds the limit and reports retryAfter", async () => {
    const windowStart = new Date(Date.now() - 600 * 1000); // 10 min into a 1h window
    const { db } = fakeDb([{ count: 11, windowStart }]);

    const result = await enforceRateLimit(db, "k", {
      max: 10,
      windowSeconds: 3600,
    });

    expect(result.allowed).toBe(false);
    // ~3000s remain (3600 window - 600 elapsed); allow a second of jitter.
    expect(result.retryAfter).toBeGreaterThanOrEqual(2999);
    expect(result.retryAfter).toBeLessThanOrEqual(3000);
  });

  it("reports at least one second of retry when the window is nearly over", async () => {
    const windowStart = new Date(Date.now() - 3599.9 * 1000);
    const { db } = fakeDb([{ count: 50, windowStart }]);

    const result = await enforceRateLimit(db, "k", {
      max: 10,
      windowSeconds: 3600,
    });

    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThanOrEqual(1);
  });

  it("fails open when the counter store throws", async () => {
    const { db } = fakeDb(() => {
      throw new Error("db down");
    });

    const result = await enforceRateLimit(db, "k", {
      max: 1,
      windowSeconds: 60,
    });

    expect(result).toEqual({ allowed: true, retryAfter: 0 });
  });
});

describe("createAuthRateLimitStorage", () => {
  it("maps an allowed consume to a null retryAfter", async () => {
    const { db } = fakeDb([{ count: 1, windowStart: new Date() }]);
    const storage = createAuthRateLimitStorage(db);

    await expect(
      storage.consume("ip:/sign-in/social", { window: 60, max: 20 }),
    ).resolves.toEqual({ allowed: true, retryAfter: null });
  });

  it("maps a blocked consume to a numeric retryAfter", async () => {
    const windowStart = new Date(Date.now() - 10 * 1000);
    const { db } = fakeDb([{ count: 21, windowStart }]);
    const storage = createAuthRateLimitStorage(db);

    const result = await storage.consume("ip:/sign-in/social", {
      window: 60,
      max: 20,
    });

    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThanOrEqual(49);
    expect(result.retryAfter).toBeLessThanOrEqual(50);
  });
});
