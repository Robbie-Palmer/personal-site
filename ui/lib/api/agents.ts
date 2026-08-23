import { apiRequest } from "@/lib/api/http";

export type AgentStatus =
  | "active"
  | "pending"
  | "expired"
  | "revoked"
  | "rejected"
  | "claimed";

export type AgentCapabilityGrant = {
  capability: string;
  description?: string;
  expiresAt?: string;
  status: string;
};

export type AgentSummary = {
  id: string;
  name: string;
  status: AgentStatus;
  mode: "delegated" | "autonomous";
  hostId: string;
  hostName: string;
  capabilityGrants: AgentCapabilityGrant[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
};

export type AgentDetail = Omit<AgentSummary, "hostName"> & {
  activatedAt: string | null;
};

export type AgentHost = {
  id: string;
  name: string;
  status: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullableString(value: unknown): string | null | undefined {
  return value === null || typeof value === "string" ? value : undefined;
}

function capabilityGrants(value: unknown): AgentCapabilityGrant[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const grants: AgentCapabilityGrant[] = [];
  for (const item of value) {
    if (
      !isRecord(item) ||
      typeof item.capability !== "string" ||
      typeof item.status !== "string"
    ) {
      return undefined;
    }
    const expiresAt =
      item.expires_at === undefined
        ? undefined
        : nullableString(item.expires_at);
    if (item.expires_at !== undefined && expiresAt === undefined) {
      return undefined;
    }
    if (
      item.description !== undefined &&
      typeof item.description !== "string"
    ) {
      return undefined;
    }
    grants.push({
      capability: item.capability,
      status: item.status,
      ...(typeof item.description === "string"
        ? { description: item.description }
        : {}),
      ...(typeof expiresAt === "string" ? { expiresAt } : {}),
    });
  }
  return grants;
}

const AGENT_STATUSES = new Set<AgentStatus>([
  "active",
  "pending",
  "expired",
  "revoked",
  "rejected",
  "claimed",
]);

type AgentBase = Omit<AgentSummary, "hostName">;

function agentBase(value: unknown): AgentBase | undefined {
  if (!isRecord(value)) return undefined;
  const status = value.status;
  const mode = value.mode;
  const grants = capabilityGrants(value.agent_capability_grants);
  const lastUsedAt = nullableString(value.last_used_at);
  const expiresAt = nullableString(value.expires_at);
  if (
    typeof value.agent_id !== "string" ||
    typeof value.name !== "string" ||
    typeof status !== "string" ||
    !AGENT_STATUSES.has(status as AgentStatus) ||
    (mode !== "delegated" && mode !== "autonomous") ||
    typeof value.host_id !== "string" ||
    !grants ||
    typeof value.created_at !== "string" ||
    lastUsedAt === undefined ||
    expiresAt === undefined
  ) {
    return undefined;
  }
  return {
    id: value.agent_id,
    name: value.name,
    status: status as AgentStatus,
    mode,
    hostId: value.host_id,
    capabilityGrants: grants,
    createdAt: value.created_at,
    lastUsedAt,
    expiresAt,
  };
}

function parseAgentSummary(value: unknown): AgentSummary | undefined {
  const base = agentBase(value);
  if (!base || !isRecord(value) || typeof value.host_name !== "string") {
    return undefined;
  }
  return { ...base, hostName: value.host_name };
}

function parseAgentDetail(value: unknown): AgentDetail | undefined {
  const base = agentBase(value);
  if (!base || !isRecord(value)) return undefined;
  const activatedAt = nullableString(value.activated_at);
  if (activatedAt === undefined) return undefined;
  return { ...base, activatedAt };
}

export async function listAgents(
  signal?: AbortSignal,
): Promise<AgentSummary[]> {
  const body = await apiRequest<unknown>("/api/auth/agent/list?limit=200", {
    signal,
    fallbackMessage: "Agents could not be loaded.",
  });
  if (!isRecord(body) || !Array.isArray(body.agents)) {
    throw new Error("The agent list response was invalid.");
  }
  const agents = body.agents.map(parseAgentSummary);
  if (agents.some((agent) => !agent)) {
    throw new Error("The agent list response was invalid.");
  }
  return agents as AgentSummary[];
}

export async function getAgent(
  agentId: string,
  signal?: AbortSignal,
): Promise<AgentDetail> {
  const body = await apiRequest<unknown>(
    `/api/auth/agent/get?agent_id=${encodeURIComponent(agentId)}`,
    { signal, fallbackMessage: "The agent request could not be loaded." },
  );
  const agent = parseAgentDetail(body);
  if (!agent) throw new Error("The agent request response was invalid.");
  return agent;
}

export async function getAgentHost(
  hostId: string,
  signal?: AbortSignal,
): Promise<AgentHost> {
  const body = await apiRequest<unknown>(
    `/api/auth/host/get?host_id=${encodeURIComponent(hostId)}`,
    { signal, fallbackMessage: "The agent host could not be loaded." },
  );
  if (
    !isRecord(body) ||
    typeof body.id !== "string" ||
    typeof body.name !== "string" ||
    typeof body.status !== "string"
  ) {
    throw new Error("The agent host response was invalid.");
  }
  return { id: body.id, name: body.name, status: body.status };
}

export async function revokeAgent(agentId: string): Promise<void> {
  const body = await apiRequest<unknown>("/api/auth/agent/revoke", {
    method: "POST",
    json: { agent_id: agentId },
    fallbackMessage: "Agent access could not be revoked.",
  });
  if (
    !isRecord(body) ||
    body.agent_id !== agentId ||
    body.status !== "revoked"
  ) {
    throw new Error("The agent revocation response was invalid.");
  }
}

export async function decideAgentApproval(input: {
  agentId: string;
  code: string;
  action: "approve" | "deny";
}): Promise<void> {
  await apiRequest("/api/auth/agent/approve-capability", {
    method: "POST",
    json: {
      agent_id: input.agentId,
      user_code: input.code,
      action: input.action,
    },
    fallbackMessage: "The approval decision could not be saved.",
  });
}
