import { describe, expect, it } from "vitest";
import {
  decodeCookingLogCursor,
  encodeCookingLogCursor,
} from "../src/cooking-reads";

describe("cooking-log cursors", () => {
  it("round-trips a stable completed-at and ID cursor", () => {
    const cursor = {
      completedAt: "2026-08-20T18:30:00.000Z",
      id: "00000000-0000-4000-8000-000000000062",
    };

    expect(decodeCookingLogCursor(encodeCookingLogCursor(cursor))).toEqual(
      cursor,
    );
  });

  it.each([undefined, "", "not-base64", btoa("{}")])(
    "rejects malformed cursor %s",
    (cursor) => {
      expect(decodeCookingLogCursor(cursor)).toBeUndefined();
    },
  );
});
