import { describe, expect, it } from "vitest";
import { errorMessage, isAbortError } from "@/lib/generic/errors";

describe("generic error helpers", () => {
  it("recognizes DOM abort errors", () => {
    expect(isAbortError(new DOMException("Aborted", "AbortError"))).toBe(true);
    expect(isAbortError(new DOMException("Failed", "NetworkError"))).toBe(
      false,
    );
    expect(
      isAbortError(Object.assign(new Error("Other"), { name: "AbortError" })),
    ).toBe(false);
  });

  it("uses Error messages and falls back for other rejection values", () => {
    expect(errorMessage(new Error("Specific"), "Fallback")).toBe("Specific");
    expect(errorMessage("unexpected", "Fallback")).toBe("Fallback");
  });
});
