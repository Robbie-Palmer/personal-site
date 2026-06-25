import { describe, expect, it, vi } from "vitest";
import { enforceRateLimit } from "../src/http/rate-limit";

type ReturnRow = { count: number; windowStart: Date };

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
