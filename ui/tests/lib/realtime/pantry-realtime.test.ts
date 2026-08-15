import { describe, expect, it } from "vitest";
import {
  pantryRealtimeUrl,
  parsePantryRealtimeMessage,
} from "@/lib/realtime/pantry-realtime";

describe("pantry realtime protocol", () => {
  it("accepts readiness and revisioned pantry invalidations", () => {
    expect(
      parsePantryRealtimeMessage(
        JSON.stringify({
          type: "subscription.ready",
          resourceType: "pantry",
          resourceId: "household-1",
        }),
      ),
    ).toEqual({
      type: "subscription.ready",
      resourceType: "pantry",
      resourceId: "household-1",
    });
    expect(
      parsePantryRealtimeMessage(
        JSON.stringify({
          type: "resource.changed",
          resourceType: "pantry",
          resourceId: "household-1",
          revision: "9007199254740993",
          operationId: "operation-1",
          changeKind: "pantry.item-set",
        }),
      ),
    ).toMatchObject({ type: "resource.changed", revision: "9007199254740993" });
  });

  it.each([
    "not json",
    JSON.stringify({ type: "resource.changed", resourceType: "shopping-list" }),
    JSON.stringify({
      type: "resource.changed",
      resourceType: "pantry",
      resourceId: "household-1",
      revision: "4.2",
      operationId: "operation-1",
      changeKind: "pantry.item-set",
    }),
  ])("rejects malformed or unrelated messages", (payload) => {
    expect(parsePantryRealtimeMessage(payload)).toBeUndefined();
  });

  it("uses the current origin and the matching WebSocket scheme", () => {
    expect(
      pantryRealtimeUrl({
        href: "https://pr-42.example.test/recipes/kitchen",
      } as Location),
    ).toBe("wss://pr-42.example.test/api/pantry/realtime");
    expect(
      pantryRealtimeUrl({ href: "http://localhost:3000/recipes" } as Location),
    ).toBe("ws://localhost:3000/api/pantry/realtime");
  });
});
