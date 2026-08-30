import { describe, expect, it } from "vitest";
import { pantryQuery } from "@/lib/query/pantry-queries";

describe("pantryQuery", () => {
  it("relies on realtime and window-focus recovery without polling", () => {
    const options = pantryQuery("user-1");

    expect(options.refetchInterval).toBeUndefined();
    expect(options.refetchOnWindowFocus).toBe(true);
  });
});
