import { describe, expect, it } from "vitest";
import {
  decodeFeedCursor,
  encodeFeedCursor,
  paginateRecipeFeed,
  recipeFeedCursorFilter,
} from "../src/feed-pagination";

const firstCursor = {
  createdAt: "2026-07-16 20:58:55.123456+00",
  id: "00000000-0000-0000-0000-000000000003",
};

describe("feed pagination", () => {
  it("round-trips timestamp precision through a URL-safe cursor", () => {
    const encoded = encodeFeedCursor(firstCursor);

    expect(encoded).not.toMatch(/[+/=]/);
    expect(decodeFeedCursor(encoded)).toEqual(firstCursor);
  });

  it.each([undefined, "", "not-base64", btoa("{}")])(
    "rejects an invalid cursor: %s",
    (cursor) => {
      expect(decodeFeedCursor(cursor)).toBeUndefined();
    },
  );

  it("returns one extra row as a next-page cursor", () => {
    const rows = [
      { recipe: { id: "3" }, cursorCreatedAt: "2026-07-16 03:00:00+00" },
      { recipe: { id: "2" }, cursorCreatedAt: "2026-07-16 02:00:00+00" },
      { recipe: { id: "1" }, cursorCreatedAt: "2026-07-16 01:00:00+00" },
    ];

    const page = paginateRecipeFeed(rows, 2);

    expect(page.items).toEqual(rows.slice(0, 2));
    expect(decodeFeedCursor(page.nextCursor ?? undefined)).toEqual({
      createdAt: rows[1]?.cursorCreatedAt,
      id: rows[1]?.recipe.id,
    });
  });

  it("omits the cursor on the final page", () => {
    const rows = [{ recipe: { id: "1" }, cursorCreatedAt: firstCursor.createdAt }];

    expect(paginateRecipeFeed(rows, 2)).toEqual({
      items: rows,
      nextCursor: null,
    });
    expect(recipeFeedCursorFilter(undefined)).toBeUndefined();
  });
});
