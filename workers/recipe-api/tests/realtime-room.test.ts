import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HouseholdRealtimeRoom,
  REALTIME_AUTHORIZATION_CLOSE_CODE,
  realtimeRoomRequestHeaders,
} from "../src/realtime-room";

type FakeSocket = WebSocket & {
  attachment: unknown;
  close: ReturnType<typeof vi.fn>;
  serializeAttachment: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
};

function socket(attachment: unknown): FakeSocket {
  const fake = {
    attachment,
    close: vi.fn(),
    deserializeAttachment: () => fake.attachment,
    serializeAttachment: vi.fn((value: unknown) => {
      fake.attachment = value;
    }),
    send: vi.fn(),
  } as unknown as FakeSocket;
  return fake;
}

function roomWith(sockets: FakeSocket[]) {
  const storage = {
    deleteAlarm: vi.fn(() => Promise.resolve()),
    setAlarm: vi.fn(() => Promise.resolve()),
  };
  const ctx = {
    acceptWebSocket: vi.fn(),
    getWebSockets: vi.fn(() => sockets),
    storage,
  } as unknown as DurableObjectState;
  return { room: new HouseholdRealtimeRoom(ctx, {}), storage };
}

function attachment(
  overrides: Partial<{
    userId: string;
    sessionId: string;
    resourceId: string;
    authorizationExpiresAt: number;
  }> = {},
) {
  return {
    version: 1,
    userId: "user-1",
    sessionId: "session-1",
    resourceId: "household-1",
    authorizationExpiresAt: Date.now() + 60_000,
    ...overrides,
  };
}

function connectRequest(
  overrides: Partial<Parameters<typeof realtimeRoomRequestHeaders>[0]> = {},
): Request {
  return new Request("https://room.test/connect", {
    headers: realtimeRoomRequestHeaders({
      userId: "user-1",
      sessionId: "session-1",
      resourceId: "household-1",
      authorizationExpiresAt: Date.now() + 60_000,
      ...overrides,
    }),
  });
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

  it("rejects unknown routes and invalid connection requests", async () => {
    const { room } = roomWith([]);

    const missingUpgrade = await room.fetch(
      new Request("https://room.test/connect"),
    );
    expect(missingUpgrade.status).toBe(426);

    const missingContext = await room.fetch(
      new Request("https://room.test/connect", {
        headers: { upgrade: "websocket" },
      }),
    );
    expect(missingContext.status).toBe(400);

    const notFound = await room.fetch(new Request("https://room.test/nope"));
    expect(notFound.status).toBe(404);
  });

  it("enforces room, user, and session connection limits", async () => {
    const roomSockets = Array.from({ length: 32 }, (_, index) =>
      socket(attachment({ sessionId: `session-${index}` })),
    );
    const roomLimited = await roomWith(roomSockets).room.fetch(connectRequest());
    expect(roomLimited.status).toBe(429);
    await expect(roomLimited.json()).resolves.toEqual({
      error: "Realtime room connection limit reached",
    });

    const userSockets = Array.from({ length: 8 }, (_, index) =>
      socket(attachment({ sessionId: `session-${index}` })),
    );
    const userLimited = await roomWith(userSockets).room.fetch(connectRequest());
    expect(userLimited.status).toBe(429);
    await expect(userLimited.json()).resolves.toEqual({
      error: "Realtime user connection limit reached",
    });

    const sessionSockets = Array.from({ length: 4 }, (_, index) =>
      socket(
        attachment({ userId: `user-${index}`, sessionId: "shared-session" }),
      ),
    );
    const sessionLimited = await roomWith(sessionSockets).room.fetch(
      connectRequest({ userId: "new-user", sessionId: "shared-session" }),
    );
    expect(sessionLimited.status).toBe(429);
    await expect(sessionLimited.json()).resolves.toEqual({
      error: "Realtime session connection limit reached",
    });
  });

  it("disconnects unauthorized and failed recipients during publication", async () => {
    const expired = socket(
      attachment({ authorizationExpiresAt: Date.now() - 1 }),
    );
    const wrongResource = socket(attachment({ resourceId: "household-2" }));
    const malformed = socket(null);
    const sendFailure = socket(attachment());
    sendFailure.send.mockImplementation(() => {
      throw new Error("socket closed");
    });
    const { room } = roomWith([
      expired,
      wrongResource,
      malformed,
      sendFailure,
    ]);

    const response = await room.fetch(
      new Request("https://room.test/publish", {
        method: "POST",
        body: JSON.stringify({
          type: "resource.changed",
          resourceType: "pantry",
          resourceId: "household-1",
          revision: "43",
          operationId: crypto.randomUUID(),
          changeKind: "pantry.item-removed",
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      delivered: 0,
      disconnected: 4,
    });
    expect(expired.close).toHaveBeenCalledWith(
      REALTIME_AUTHORIZATION_CLOSE_CODE,
      "Authorization expired",
    );
    expect(sendFailure.close).toHaveBeenCalledWith(
      1_011,
      "Realtime delivery failed",
    );
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

  it("retains the earliest active authorization alarm", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T12:00:00.000Z"));
    const earliestExpiry = Date.now() + 30_000;
    const malformed = socket({ version: 2 });
    const later = socket(
      attachment({ authorizationExpiresAt: Date.now() + 60_000 }),
    );
    const earlier = socket(
      attachment({ authorizationExpiresAt: earliestExpiry }),
    );
    const { room, storage } = roomWith([malformed, later, earlier]);

    await room.alarm();

    expect(malformed.close).toHaveBeenCalledWith(
      REALTIME_AUTHORIZATION_CLOSE_CODE,
      "Authorization expired",
    );
    expect(storage.setAlarm).toHaveBeenCalledWith(earliestExpiry);
  });

  it("closes client messages and WebSocket lifecycle failures", () => {
    const { room } = roomWith([]);
    const unsupported = socket(attachment());
    const oversized = socket(attachment());
    const closed = socket(attachment());
    const errored = socket(attachment());
    const alreadyClosed = socket(attachment());
    alreadyClosed.close.mockImplementation(() => {
      throw new Error("already closed");
    });

    room.webSocketMessage(unsupported, "hello");
    room.webSocketMessage(oversized, new ArrayBuffer(1_025));
    room.webSocketClose(closed, 1_000, "done");
    room.webSocketError(errored);
    expect(() => room.webSocketError(alreadyClosed)).not.toThrow();

    expect(unsupported.close).toHaveBeenCalledWith(
      1_008,
      "Client messages are not supported",
    );
    expect(oversized.close).toHaveBeenCalledWith(1_008, "Message too large");
    expect(closed.close).toHaveBeenCalledWith(1_000, "done");
    expect(errored.close).toHaveBeenCalledWith(1_011, "WebSocket error");
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
