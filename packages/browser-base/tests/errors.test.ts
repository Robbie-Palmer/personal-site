import { describe, expect, it } from "vitest";
import { isAbortError } from "../src/errors";

describe("isAbortError", () => {
  it("recognizes DOM abort errors", () => {
    expect(isAbortError(new DOMException("Aborted", "AbortError"))).toBe(true);
    expect(isAbortError(new DOMException("Failed", "NetworkError"))).toBe(
      false,
    );
    expect(
      isAbortError(Object.assign(new Error("Other"), { name: "AbortError" })),
    ).toBe(false);
  });
});
