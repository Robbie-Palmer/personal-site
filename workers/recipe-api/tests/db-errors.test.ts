import { describe, expect, it } from "vitest";
import { hasPostgresErrorCode } from "../src/db/errors";

describe("hasPostgresErrorCode", () => {
  it("recognizes a direct PostgreSQL error", () => {
    expect(hasPostgresErrorCode({ code: "23505" }, "23505")).toBe(true);
  });

  it("recognizes a PostgreSQL error wrapped by the database client", () => {
    const error = new Error("Failed query", {
      cause: new Error("Database request failed", {
        cause: { code: "23505" },
      }),
    });

    expect(hasPostgresErrorCode(error, "23505")).toBe(true);
  });

  it("does not loop forever on a cyclic cause chain", () => {
    const error: Error & { cause?: unknown } = new Error("cyclic");
    error.cause = error;

    expect(hasPostgresErrorCode(error, "23505")).toBe(false);
  });
});
