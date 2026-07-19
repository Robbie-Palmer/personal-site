import { describe, expect, it } from "vitest";
import { prioritiseSelected } from "@/lib/generic/array";

describe("prioritiseSelected", () => {
  const items = [
    { slug: "one" },
    { slug: "two" },
    { slug: "three" },
    { slug: "four" },
  ];

  it("moves selected items first while preserving each group's order", () => {
    expect(
      prioritiseSelected(items, ["three", "one"], (item) => item.slug),
    ).toEqual([items[0], items[2], items[1], items[3]]);
  });

  it("returns the original array when there are no selected keys", () => {
    expect(prioritiseSelected(items, [], (item) => item.slug)).toBe(items);
  });
});
