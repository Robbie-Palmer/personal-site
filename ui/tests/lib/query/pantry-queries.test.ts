import { describe, expect, it } from "vitest";
import { pantryQuery } from "@/lib/query/pantry-queries";

describe("pantryQuery", () => {
  it("relies on realtime updates and window-focus recovery instead of polling", () => {
    const options = pantryQuery("user-1");

    expect(options.refetchInterval).toBeUndefined();
    expect(options.refetchOnWindowFocus).toBe(true);
  });
});
