import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HouseholdRealtimeRoom,
  REALTIME_AUTHORIZATION_CLOSE_CODE,
  realtimeRoomRequestHeaders,
} from "../src/realtime-room";

type FakeSocket = WebSocket & {
  attachment: unknown;
  close: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
};

function socket(attachment: unknown): FakeSocket {
  return {
    attachment,
    close: vi.fn(),
    deserializeAttachment: () => attachment,
    send: vi.fn(),
  } as unknown as FakeSocket;
}

function roomWith(sockets: FakeSocket[]) {
  const storage = {
    deleteAlarm: vi.fn(() => Promise.resolve()),
    setAlarm: vi.fn(() => Promise.resolve()),
  };
  const ctx = {
    getWebSockets: vi.fn(() => sockets),
    storage,
  } as unknown as DurableObjectState;
  return { room: new HouseholdRealtimeRoom(ctx, {}), storage };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("HouseholdRealtimeRoom", () => {
  it("fans a validated revision invalidation out to authorized sockets", async () => {
    const active = socket({
      version: 1,
      userId: "user-1",
      sessionId: "session-1",
      resourceId: "household-1",
      authorizationExpiresAt: Date.now() + 60_000,
    });
    const { room } = roomWith([active]);
    const event = {
      type: "resource.changed",
      resourceType: "pantry",
      resourceId: "household-1",
      revision: "42",
      operationId: crypto.randomUUID(),
      changeKind: "pantry.item-set",
    };

    const response = await room.fetch(
      new Request("https://room.test/publish", {
        method: "POST",
        body: JSON.stringify(event),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      delivered: 1,
      disconnected: 0,
    });
    expect(active.send).toHaveBeenCalledWith(JSON.stringify(event));
  });

  it("rejects malformed publication payloads", async () => {
    const { room } = roomWith([]);
    const response = await room.fetch(
      new Request("https://room.test/publish", {
        method: "POST",
        body: JSON.stringify({ type: "resource.changed", revision: "nope" }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("expires reconstructed sockets from serialized attachments", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T12:00:00.000Z"));
    const expired = socket({
      version: 1,
      userId: "user-1",
      sessionId: "session-1",
      resourceId: "household-1",
      authorizationExpiresAt: Date.now() - 1,
    });
    const { room, storage } = roomWith([expired]);

    await room.alarm();

    expect(expired.close).toHaveBeenCalledWith(
      REALTIME_AUTHORIZATION_CLOSE_CODE,
      "Authorization expired",
    );
    expect(storage.deleteAlarm).toHaveBeenCalledOnce();
  });

  it("builds a server-authored connection context without client headers", () => {
    const headers = realtimeRoomRequestHeaders({
      userId: "user-1",
      sessionId: "session-1",
      resourceId: "household-1",
      authorizationExpiresAt: 123_456,
    });

    expect(Object.fromEntries(headers)).toEqual({
      upgrade: "websocket",
      "x-realtime-authorization-expires-at": "123456",
      "x-realtime-resource-id": "household-1",
      "x-realtime-session-id": "session-1",
      "x-realtime-user-id": "user-1",
    });
  });
});
