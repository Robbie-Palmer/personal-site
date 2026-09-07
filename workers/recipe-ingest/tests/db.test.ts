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

  it("returns the operation result and closes the client", async () => {
    const operation = vi.fn().mockResolvedValue("done");

    await expect(
      withDb({ DATABASE_URL: "postgres://unused" }, operation),
    ).resolves.toBe("done");
    expect(operation).toHaveBeenCalledOnce();
  });

  it("closes the client when the operation fails", async () => {
    const error = new Error("operation failed");

    await expect(
      withDb({ DATABASE_URL: "postgres://unused" }, async () => {
        throw error;
      }),
    ).rejects.toBe(error);
  });

  it("accepts an absent client during cleanup", async () => {
    await expect(closeDbClient(undefined)).resolves.toBeUndefined();
  });

  it("closes a connected client", async () => {
    const end = vi.fn().mockResolvedValue(undefined);

    await expect(
      closeDbClient({ end } as unknown as DbClient),
    ).resolves.toBeUndefined();
    expect(end).toHaveBeenCalledWith({ timeout: 5 });
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
