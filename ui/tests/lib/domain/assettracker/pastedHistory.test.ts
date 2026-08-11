import { describe, expect, it } from "vitest";
import { parsePastedHistory } from "@/lib/domain/assettracker/pastedHistory";

describe("parsePastedHistory", () => {
  it("accepts CSV with an optional header and sorts by date", () => {
    expect(
      parsePastedHistory("date,value\n2024-02-29,13120\n2024-01-31,12500"),
    ).toEqual({
      rows: [
        { date: "2024-01-31", value: 12500 },
        { date: "2024-02-29", value: 13120 },
      ],
      issues: [],
    });
  });

  it("accepts tab-separated UK dates, currency and signed withdrawals", () => {
    const result = parsePastedHistory(
      "31/01/2024\t£1,234.56\n29/02/2024\t-200",
    );

    expect(result).toEqual({
      rows: [
        { date: "2024-01-31", value: 1234.56 },
        { date: "2024-02-29", value: -200 },
      ],
      issues: [],
    });
  });

  it("accepts quoted and unquoted thousands separators", () => {
    expect(parsePastedHistory('2024-01-31,"£1,234.56"').rows[0]?.value).toBe(
      1234.56,
    );
    expect(parsePastedHistory("2024-01-31,1,234.56").rows[0]?.value).toBe(
      1234.56,
    );
  });

  it("recognises accounting negatives after a currency symbol", () => {
    expect(parsePastedHistory("2024-01-31,£(1,234.56)").rows[0]?.value).toBe(
      -1234.56,
    );
  });

  it("reports every malformed and duplicate row", () => {
    const result = parsePastedHistory(
      "2024-02-30,10\n2024-01-31,nope\n2024-01-31,20\n2024-01-31,30",
    );

    expect(result.rows).toEqual([{ date: "2024-01-31", value: 20 }]);
    expect(result.issues).toEqual([
      { line: 1, message: "Use YYYY-MM-DD or DD/MM/YYYY for the date" },
      { line: 2, message: "Value must be a valid number" },
      { line: 4, message: "Duplicate date 2024-01-31" },
    ]);
  });
});
