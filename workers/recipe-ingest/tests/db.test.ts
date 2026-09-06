import { afterEach, describe, expect, it, vi } from "vitest";
import type { DbClient } from "recipe-db";
import {
  closeDbClient,
  databaseConnection,
  withDb,
} from "recipe-db";

describe("database connection lifecycle", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prefers Hyperdrive and falls back to a direct database URL", () => {
    expect(
      databaseConnection({
        HYPERDRIVE: { connectionString: "postgres://hyperdrive" },
        DATABASE_URL: "postgres://direct",
      }),
    ).toBe("postgres://hyperdrive");
    expect(databaseConnection({ DATABASE_URL: "postgres://direct" })).toBe(
      "postgres://direct",
    );
    expect(databaseConnection({})).toBeUndefined();
  });

  it("rejects operations without a configured database", async () => {
    const operation = vi.fn();

    await expect(withDb({}, operation)).rejects.toThrow(
      "No database connection configured",
    );
    expect(operation).not.toHaveBeenCalled();
  });

  it("records cleanup failures without rejecting", async () => {
    const error = new Error("close failed");
    const end = vi.fn().mockRejectedValue(error);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      closeDbClient({ end } as unknown as DbClient),
    ).resolves.toBeUndefined();
    expect(end).toHaveBeenCalledWith({ timeout: 5 });
    expect(consoleError).toHaveBeenCalledWith(
      "client.end() cleanup failed",
      error,
    );
  });
});
