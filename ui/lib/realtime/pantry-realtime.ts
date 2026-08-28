import type { Pantry } from "@/lib/api/pantry";

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
      pantry: Pantry;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    isRecord(value) &&
    Object.values(value).every((item) => typeof item === "string")
  );
}

function isPantry(value: unknown): value is Pantry {
  if (!isRecord(value)) return false;
  const scope = value.scope;
  const validScope =
    isRecord(scope) &&
    (scope.type === "personal" ||
      (scope.type === "household" &&
        isRecord(scope.household) &&
        typeof scope.household.id === "string" &&
        typeof scope.household.name === "string"));
  return (
    typeof value.resourceId === "string" &&
    typeof value.revision === "string" &&
    /^\d+$/.test(value.revision) &&
    (value.operationId === undefined ||
      typeof value.operationId === "string") &&
    validScope &&
    isStringRecord(value.stock) &&
    isStringRecord(value.itemVersions)
  );
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
    typeof value.changeKind !== "string" ||
    !isPantry(value.pantry) ||
    value.pantry.resourceId !== value.resourceId ||
    value.pantry.revision !== value.revision ||
    value.pantry.operationId !== value.operationId
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
