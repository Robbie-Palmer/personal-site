import { describe, expect, it } from "vitest";
import { isRecord } from "../src/records";

describe("isRecord", () => {
  it("accepts records without treating arrays as records", () => {
    expect(isRecord({ recipe: "soup" })).toBe(true);
    expect(isRecord(Object.create(null))).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
  });
});
