import { describe, expect, it } from "vitest";
import { errorMessage } from "../src/errors";

describe("errorMessage", () => {
  it("uses Error messages and falls back for other rejection values", () => {
    expect(errorMessage(new Error("Specific"), "Fallback")).toBe("Specific");
    expect(errorMessage("unexpected", "Fallback")).toBe("Fallback");
  });
});
