const INTERNAL_USER_ID_HEADER = "x-realtime-user-id";
const INTERNAL_SESSION_ID_HEADER = "x-realtime-session-id";
const INTERNAL_RESOURCE_ID_HEADER = "x-realtime-resource-id";
const INTERNAL_AUTHORIZATION_EXPIRY_HEADER =
  "x-realtime-authorization-expires-at";

const MAX_ROOM_CONNECTIONS = 32;
const MAX_USER_CONNECTIONS = 8;
const MAX_SESSION_CONNECTIONS = 4;
const MAX_CLIENT_MESSAGE_BYTES = 1_024;
export const REALTIME_AUTHORIZATION_LIFETIME_MS = 5 * 60_000;
export const REALTIME_AUTHORIZATION_CLOSE_CODE = 4_001;

type SocketAttachment = {
  version: 1;
  userId: string;
  sessionId: string;
  resourceId: string;
  authorizationExpiresAt: number;
};

export type PantryChangeKind =
  | "pantry.replaced"
  | "pantry.restored"
  | "pantry.item-set"
  | "pantry.item-removed";

export type PantryRealtimeEvent = {
  type: "resource.changed";
  resourceType: "pantry";
  resourceId: string;
  revision: string;
  operationId: string;
  changeKind: PantryChangeKind;
};

function json(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function attachmentFor(socket: WebSocket): SocketAttachment | undefined {
  try {
    const value = socket.deserializeAttachment();
    if (!value || typeof value !== "object") return undefined;
    const attachment = value as Partial<SocketAttachment>;
    return attachment.version === 1 &&
      typeof attachment.userId === "string" &&
      typeof attachment.sessionId === "string" &&
      typeof attachment.resourceId === "string" &&
      typeof attachment.authorizationExpiresAt === "number"
      ? (attachment as SocketAttachment)
      : undefined;
  } catch {
    return undefined;
  }
}

function parseChangeEvent(value: unknown): PantryRealtimeEvent | undefined {
  if (!value || typeof value !== "object") return undefined;
  const event = value as Partial<PantryRealtimeEvent>;
  if (
    event.type !== "resource.changed" ||
    event.resourceType !== "pantry" ||
    typeof event.resourceId !== "string" ||
    !/^\d+$/.test(event.revision ?? "") ||
    typeof event.operationId !== "string" ||
    ![
      "pantry.replaced",
      "pantry.restored",
      "pantry.item-set",
      "pantry.item-removed",
    ].includes(event.changeKind ?? "")
  ) {
    return undefined;
  }
  return event as PantryRealtimeEvent;
}

function closeSocket(socket: WebSocket, code: number, reason: string): void {
  try {
    socket.close(code, reason);
  } catch {
    // A socket may already have closed between enumeration and cleanup.
  }
}

export class HouseholdRealtimeRoom {
  constructor(
    private readonly ctx: DurableObjectState,
    _env: unknown,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/connect") {
      return this.connect(request);
    }
    if (request.method === "POST" && url.pathname === "/publish") {
      return this.publish(request);
    }
    return json({ error: "Not found" }, 404);
  }

  webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): void {
    const size =
      typeof message === "string"
        ? new TextEncoder().encode(message).length
        : message.byteLength;
    closeSocket(
      socket,
      1_008,
      size > MAX_CLIENT_MESSAGE_BYTES
        ? "Message too large"
        : "Client messages are not supported",
    );
  }

  webSocketClose(socket: WebSocket, code: number, reason: string): void {
    closeSocket(socket, code, reason);
  }

  webSocketError(socket: WebSocket): void {
    closeSocket(socket, 1_011, "WebSocket error");
  }

  async alarm(): Promise<void> {
    const now = Date.now();
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = attachmentFor(socket);
      if (!attachment || attachment.authorizationExpiresAt <= now) {
        closeSocket(
          socket,
          REALTIME_AUTHORIZATION_CLOSE_CODE,
          "Authorization expired",
        );
      }
    }
    await this.scheduleAuthorizationAlarm();
  }

  private async connect(request: Request): Promise<Response> {
    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return json({ error: "WebSocket upgrade required" }, 426);
    }

    const userId = request.headers.get(INTERNAL_USER_ID_HEADER);
    const sessionId = request.headers.get(INTERNAL_SESSION_ID_HEADER);
    const resourceId = request.headers.get(INTERNAL_RESOURCE_ID_HEADER);
    const authorizationExpiresAt = Number(
      request.headers.get(INTERNAL_AUTHORIZATION_EXPIRY_HEADER),
    );
    if (
      !userId ||
      !sessionId ||
      !resourceId ||
      !Number.isSafeInteger(authorizationExpiresAt) ||
      authorizationExpiresAt <= Date.now()
    ) {
      return json({ error: "Invalid realtime connection context" }, 400);
    }

    const sockets = this.ctx.getWebSockets();
    const attachments = sockets.map(attachmentFor);
    if (sockets.length >= MAX_ROOM_CONNECTIONS) {
      return json({ error: "Realtime room connection limit reached" }, 429);
    }
    if (
      attachments.filter((item) => item?.userId === userId).length >=
      MAX_USER_CONNECTIONS
    ) {
      return json({ error: "Realtime user connection limit reached" }, 429);
    }
    if (
      attachments.filter((item) => item?.sessionId === sessionId).length >=
      MAX_SESSION_CONNECTIONS
    ) {
      return json({ error: "Realtime session connection limit reached" }, 429);
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server, ["pantry"]);
    server.serializeAttachment({
      version: 1,
      userId,
      sessionId,
      resourceId,
      authorizationExpiresAt,
    } satisfies SocketAttachment);
    await this.scheduleAuthorizationAlarm();

    server.send(
      JSON.stringify({
        type: "subscription.ready",
        resourceType: "pantry",
        resourceId,
      }),
    );
    return new Response(null, { status: 101, webSocket: client });
  }

  private async publish(request: Request): Promise<Response> {
    const event = parseChangeEvent(await request.json().catch(() => null));
    if (!event) return json({ error: "Invalid realtime event" }, 400);

    let delivered = 0;
    let disconnected = 0;
    const payload = JSON.stringify(event);
    for (const socket of this.ctx.getWebSockets("pantry")) {
      const attachment = attachmentFor(socket);
      if (
        attachment?.resourceId !== event.resourceId ||
        attachment.authorizationExpiresAt <= Date.now()
      ) {
        disconnected += 1;
        closeSocket(
          socket,
          REALTIME_AUTHORIZATION_CLOSE_CODE,
          "Authorization expired",
        );
        continue;
      }
      try {
        socket.send(payload);
        delivered += 1;
      } catch {
        disconnected += 1;
        closeSocket(socket, 1_011, "Realtime delivery failed");
      }
    }
    return json({ delivered, disconnected });
  }

  private async scheduleAuthorizationAlarm(): Promise<void> {
    const now = Date.now();
    const nextExpiry = this.ctx
      .getWebSockets()
      .map(attachmentFor)
      .reduce<number | undefined>((earliest, attachment) => {
        if (!attachment || attachment.authorizationExpiresAt <= now) {
          return earliest;
        }
        return earliest === undefined
          ? attachment.authorizationExpiresAt
          : Math.min(earliest, attachment.authorizationExpiresAt);
      }, undefined);
    if (nextExpiry === undefined) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    await this.ctx.storage.setAlarm(nextExpiry);
  }
}

export function realtimeRoomRequestHeaders(input: {
  userId: string;
  sessionId: string;
  resourceId: string;
  authorizationExpiresAt: number;
}): Headers {
  const headers = new Headers({ upgrade: "websocket" });
  headers.set(INTERNAL_USER_ID_HEADER, input.userId);
  headers.set(INTERNAL_SESSION_ID_HEADER, input.sessionId);
  headers.set(INTERNAL_RESOURCE_ID_HEADER, input.resourceId);
  headers.set(
    INTERNAL_AUTHORIZATION_EXPIRY_HEADER,
    input.authorizationExpiresAt.toString(),
  );
  return headers;
}
