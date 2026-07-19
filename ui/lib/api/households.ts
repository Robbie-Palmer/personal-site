export type HouseholdRole = "owner" | "member";

export type Household = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  createdAt: string;
  updatedAt: string;
  membership: {
    id: string;
    role: HouseholdRole;
  };
};

export type HouseholdDetails = Omit<Household, "membership">;

export type HouseholdMember = {
  id: string;
  role: HouseholdRole;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name: string;
    image: string | null;
  };
};

export type HouseholdInvitation = {
  id: string;
  householdId: string;
  email: string;
  role: "member";
  status: "pending" | "accepted" | "rejected" | "canceled";
  expiresAt: string;
  createdAt: string;
};

export type IncomingHouseholdInvitation = HouseholdInvitation & {
  household: {
    id: string;
    name: string;
  };
};

type ApiErrorBody = {
  error?: string;
  details?: { path?: string[]; message?: string }[];
};

async function parseResponse<T>(
  response: Response,
  fallback: string,
): Promise<T> {
  if (response.ok) {
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    if (!text) throw new Error(fallback);
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(fallback);
    }
  }

  const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
  const details = body?.details
    ?.map((detail) => detail.message)
    .filter((message): message is string => Boolean(message));
  throw new Error(details?.join("; ") || body?.error || fallback);
}

async function mutate(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<Response> {
  return fetch(path, {
    method,
    credentials: "same-origin",
    headers:
      body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function getHouseholds(
  signal?: AbortSignal,
): Promise<Household[]> {
  const response = await fetch("/api/households", {
    credentials: "same-origin",
    signal,
  });
  return parseResponse(response, "Couldn't load your household.");
}

export async function getIncomingHouseholdInvitations(
  signal?: AbortSignal,
): Promise<IncomingHouseholdInvitation[]> {
  const response = await fetch("/api/households/invitations", {
    credentials: "same-origin",
    signal,
  });
  return parseResponse(response, "Couldn't load your household invitations.");
}

export async function createHousehold(name: string): Promise<HouseholdDetails> {
  const response = await mutate("/api/households", "POST", { name });
  return parseResponse<HouseholdDetails>(
    response,
    "Couldn't create the household.",
  );
}

export async function renameHousehold(
  householdId: string,
  name: string,
): Promise<HouseholdDetails> {
  const response = await mutate(`/api/households/${householdId}`, "PATCH", {
    name,
  });
  return parseResponse(response, "Couldn't rename the household.");
}

export async function getHouseholdMembers(
  householdId: string,
  signal?: AbortSignal,
): Promise<HouseholdMember[]> {
  const response = await fetch(`/api/households/${householdId}/members`, {
    credentials: "same-origin",
    signal,
  });
  return parseResponse(response, "Couldn't load household members.");
}

export async function getHouseholdInvitations(
  householdId: string,
  signal?: AbortSignal,
): Promise<HouseholdInvitation[]> {
  const response = await fetch(`/api/households/${householdId}/invitations`, {
    credentials: "same-origin",
    signal,
  });
  return parseResponse(response, "Couldn't load pending invitations.");
}

export async function inviteHouseholdMember(
  householdId: string,
  email: string,
): Promise<HouseholdInvitation> {
  const response = await mutate(
    `/api/households/${householdId}/invitations`,
    "POST",
    { email },
  );
  return parseResponse(response, "Couldn't send the invitation.");
}

export async function acceptHouseholdInvitation(
  invitationId: string,
): Promise<void> {
  const response = await mutate(
    `/api/households/invitations/${invitationId}/accept`,
    "POST",
  );
  await parseResponse(response, "Couldn't accept the household invitation.");
}

export async function declineHouseholdInvitation(
  invitationId: string,
): Promise<void> {
  const response = await mutate(
    `/api/households/invitations/${invitationId}/decline`,
    "POST",
  );
  await parseResponse(response, "Couldn't decline the household invitation.");
}

export async function revokeHouseholdInvitation(
  householdId: string,
  invitationId: string,
): Promise<void> {
  const response = await mutate(
    `/api/households/${householdId}/invitations/${invitationId}`,
    "DELETE",
  );
  await parseResponse<HouseholdInvitation>(
    response,
    "Couldn't revoke the invitation.",
  );
}

export async function removeHouseholdMember(
  householdId: string,
  memberId: string,
): Promise<void> {
  const response = await mutate(
    `/api/households/${householdId}/members/${memberId}`,
    "DELETE",
  );
  await parseResponse<void>(response, "Couldn't remove the household member.");
}

export async function leaveHousehold(householdId: string): Promise<void> {
  const response = await mutate(`/api/households/${householdId}/leave`, "POST");
  await parseResponse<void>(response, "Couldn't leave the household.");
}

export async function deleteHousehold(householdId: string): Promise<void> {
  const response = await mutate(`/api/households/${householdId}`, "DELETE");
  await parseResponse<void>(response, "Couldn't delete the household.");
}
