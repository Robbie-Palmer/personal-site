import { describe, expect, it } from "vitest";
import { pantryQuery } from "@/lib/query/pantry-queries";

describe("pantryQuery", () => {
  it("uses realtime with a low-frequency recovery refetch", () => {
    const options = pantryQuery("user-1");

    expect(options.refetchInterval).toBe(5 * 60_000);
    expect(options.refetchOnWindowFocus).toBe(true);
  });
});
