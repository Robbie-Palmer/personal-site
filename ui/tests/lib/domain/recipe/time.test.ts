import { describe, expect, it } from "vitest";
import { formatRecipeTime } from "@/lib/domain/recipe/time";

describe("formatRecipeTime", () => {
  it.each([
    [15, "15 min"],
    [60, "1h"],
    [75, "1h 15m"],
    [120, "2h"],
  ])("formats %i minutes as %s", (minutes, expected) => {
    expect(formatRecipeTime(minutes)).toBe(expected);
  });
});
