export type PantryRealtimeMessage =
  | {
      type: "subscription.ready";
      resourceType: "pantry";
      resourceId: string;
    }
  | {
      type: "resource.changed";
      resourceType: "pantry";
      resourceId: string;
      revision: string;
      operationId: string;
      changeKind: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parsePantryRealtimeMessage(
  payload: string,
): PantryRealtimeMessage | undefined {
  let value: unknown;
  try {
    value = JSON.parse(payload);
  } catch {
    return undefined;
  }
  if (
    !isRecord(value) ||
    value.resourceType !== "pantry" ||
    typeof value.resourceId !== "string"
  ) {
    return undefined;
  }
  if (value.type === "subscription.ready") {
    return value as PantryRealtimeMessage;
  }
  if (
    value.type !== "resource.changed" ||
    typeof value.revision !== "string" ||
    !/^\d+$/.test(value.revision) ||
    typeof value.operationId !== "string" ||
    typeof value.changeKind !== "string"
  ) {
    return undefined;
  }
  return value as PantryRealtimeMessage;
}

export function pantryRealtimeUrl(location: Location): string {
  const url = new URL("/api/pantry/realtime", location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}
