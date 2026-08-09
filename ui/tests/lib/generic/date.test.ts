import { describe, expect, it } from "vitest";
import { formatDate } from "@/lib/generic/date";

describe("formatDate", () => {
  it("preserves the calendar date in timezones west of UTC", () => {
    expect(formatDate("2020-07-25")).toBe("July 25, 2020");
  });

  it("formats leap days without timezone rollover", () => {
    expect(formatDate("2024-02-29")).toBe("February 29, 2024");
  });
});
