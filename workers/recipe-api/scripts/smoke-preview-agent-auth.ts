import {
  exportJWK,
  generateKeyPair,
  type JWK,
  SignJWT,
} from "jose";

const REQUEST_TIMEOUT_MS = 15_000;
const APPROVAL_TIMEOUT_MS = 10 * 60_000;
const APPROVAL_POLL_MS = 2_000;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function previewSiteURL(): string {
  const siteURL = new URL(requiredEnv("PREVIEW_SITE_URL"));
  const pagesHost =
    process.env.CLOUDFLARE_PAGES_HOST ?? "personal-site-bu5.pages.dev";
  if (
    siteURL.protocol !== "https:" ||
    !/^pr-[1-9][0-9]*$/.test(siteURL.hostname.split(".")[0] ?? "") ||
    siteURL.hostname !== `${siteURL.hostname.split(".")[0]}.${pagesHost}` ||
    siteURL.pathname !== "/"
  ) {
    throw new Error(
      `Refusing to send Access credentials to non-preview URL: ${siteURL.href}`,
    );
  }
  return siteURL.origin;
}

const siteURL = previewSiteURL();
const accessHeaders = {
  "CF-Access-Client-Id": requiredEnv("CF_ACCESS_CLIENT_ID"),
  "CF-Access-Client-Secret": requiredEnv("CF_ACCESS_CLIENT_SECRET"),
};

async function request(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = new URL(input, siteURL);
  if (url.origin !== siteURL) {
    throw new Error(`Refusing cross-origin preview request: ${url.href}`);
  }
  return fetch(url, {
    ...init,
    headers: { ...accessHeaders, ...init.headers },
    redirect: "manual",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

async function expectJson<T>(
  input: string,
  init: RequestInit = {},
  expectedStatus = 200,
): Promise<T> {
  const response = await request(input, init);
  if (response.status !== expectedStatus) {
    throw new Error(
      `${init.method ?? "GET"} ${new URL(input, siteURL).pathname} returned ${response.status}: ${await response.text()}`,
    );
  }
  return response.json() as Promise<T>;
}

function sessionCookie(response: Response): string {
  const cookie = response.headers
    .get("set-cookie")
    ?.match(/(?:__Secure-)?better-auth[.-]session_token=[^;,\s]+/)?.[0];
  if (!cookie) {
    throw new Error("Preview sign-in returned no session-token cookie");
  }
  return cookie;
}

type Discovery = {
  issuer: string;
  endpoints: {
    register: string;
    execute: string;
    status: string;
  };
};

type Approval = {
  device_code: string;
  method: "device_authorization";
  user_code: string;
  verification_uri_complete: string;
};

type Registration = {
  agent_id: string;
  host_id: string;
  status: string;
  approval: Approval;
};

type AgentStatus = {
  status: string;
  agent_capability_grants: Array<{
    capability: string;
    status: string;
  }>;
};

async function publicJWK(publicKey: CryptoKey, kid: string): Promise<JWK> {
  return {
    ...(await exportJWK(publicKey)),
    alg: "EdDSA",
    kid,
    use: "sig",
  };
}

async function signedJWT(
  privateKey: CryptoKey,
  protectedHeader: { kid: string; typ: "agent+jwt" | "host+jwt" },
  payload: Record<string, unknown>,
  issuer: string,
  audience: string,
  subject?: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1_000);
  let token = new SignJWT(payload)
    .setProtectedHeader({ alg: "EdDSA", ...protectedHeader })
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt(now)
    .setExpirationTime(now + 45)
    .setJti(crypto.randomUUID());
  if (subject) token = token.setSubject(subject);
  return token.sign(privateKey);
}

async function hostJWT(
  privateKey: CryptoKey,
  kid: string,
  hostId: string,
  issuer: string,
  payload: Record<string, unknown> = {},
): Promise<string> {
  return signedJWT(
    privateKey,
    { kid, typ: "host+jwt" },
    payload,
    hostId,
    issuer,
  );
}

async function agentJWT(
  privateKey: CryptoKey,
  kid: string,
  agentId: string,
  hostId: string,
  issuer: string,
  capability: string,
): Promise<string> {
  return signedJWT(
    privateKey,
    { kid, typ: "agent+jwt" },
    { capabilities: [capability] },
    hostId,
    issuer,
    agentId,
  );
}

async function execute(
  endpoint: string,
  token: string,
  capability: string,
  args: Record<string, unknown>,
): Promise<Response> {
  return request(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ capability, arguments: args }),
  });
}

const discovery = await expectJson<Discovery>(
  "/.well-known/agent-configuration",
);
if (
  !discovery.issuer.startsWith(`${siteURL}/api/auth`) ||
  !Object.values(discovery.endpoints).every((endpoint) =>
    endpoint.startsWith(`${siteURL}/api/auth/`),
  )
) {
  throw new Error("Agent discovery returned endpoints outside the PR preview");
}

const signIn = await request("/api/auth/preview/sign-in", {
  method: "POST",
  headers: { "content-type": "application/json", origin: siteURL },
  body: JSON.stringify({ scenario: "user-with-recipes" }),
});
if (!signIn.ok) {
  throw new Error(`Preview sign-in failed (${signIn.status})`);
}
const cookie = sessionCookie(signIn);

const hostKeys = await generateKeyPair("EdDSA");
const agentKeys = await generateKeyPair("EdDSA");
const hostKid = `preview-host-${crypto.randomUUID()}`;
const agentKid = `preview-agent-${crypto.randomUUID()}`;
const hostPublicKey = await publicJWK(hostKeys.publicKey, hostKid);
const agentPublicKey = await publicJWK(agentKeys.publicKey, agentKid);

const host = await expectJson<{ hostId: string; status: string }>(
  "/api/auth/host/create",
  {
    method: "POST",
    headers: {
      cookie,
      "content-type": "application/json",
      origin: siteURL,
    },
    body: JSON.stringify({
      name: "ADR 061 preview smoke host",
      public_key: hostPublicKey,
      default_capabilities: [],
    }),
  },
);
if (host.status !== "active") {
  throw new Error(`Preview host has unexpected status: ${host.status}`);
}

const registrationToken = await hostJWT(
  hostKeys.privateKey,
  hostKid,
  host.hostId,
  discovery.issuer,
  {
    agent_public_key: agentPublicKey,
    host_name: "ADR 061 preview smoke host",
  },
);
const registration = await expectJson<Registration>(
  discovery.endpoints.register,
  {
    method: "POST",
    headers: {
      authorization: `Bearer ${registrationToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      name: "ADR 061 preview smoke agent",
      capabilities: ["recipes.search", "recipes.read"],
      reason: "Verify delegated recipe reads on PR preview",
      mode: "delegated",
      preferred_method: "device_authorization",
    }),
  },
);
if (
  registration.status !== "pending" ||
  registration.approval.method !== "device_authorization"
) {
  throw new Error(`Agent has unexpected status: ${registration.status}`);
}

const pendingToken = await agentJWT(
  agentKeys.privateKey,
  agentKid,
  registration.agent_id,
  registration.host_id,
  discovery.issuer,
  "recipes.search",
);
const pendingExecution = await execute(
  discovery.endpoints.execute,
  pendingToken,
  "recipes.search",
  { query: "Preview" },
);
if (pendingExecution.status !== 403) {
  throw new Error(
    `Pending agent execution returned ${pendingExecution.status}, expected 403`,
  );
}

console.log(`Approval code: ${registration.approval.user_code}`);
console.log(`Approve or deny at: ${registration.approval.verification_uri_complete}`);
console.log("Waiting for approval...");

const deadline = Date.now() + APPROVAL_TIMEOUT_MS;
let status: AgentStatus | undefined;
while (Date.now() < deadline) {
  const statusToken = await hostJWT(
    hostKeys.privateKey,
    hostKid,
    host.hostId,
    discovery.issuer,
  );
  status = await expectJson<AgentStatus>(
    `${discovery.endpoints.status}?agent_id=${encodeURIComponent(registration.agent_id)}`,
    { headers: { authorization: `Bearer ${statusToken}` } },
  );
  if (status.status === "active") break;
  if (["rejected", "revoked", "expired"].includes(status.status)) {
    throw new Error(`Agent approval ended with status: ${status.status}`);
  }
  await new Promise((resolve) => setTimeout(resolve, APPROVAL_POLL_MS));
}
if (status?.status !== "active") {
  throw new Error("Timed out waiting for agent approval");
}
for (const capability of ["recipes.search", "recipes.read"]) {
  if (
    !status.agent_capability_grants.some(
      (grant) =>
        grant.capability === capability && grant.status === "active",
    )
  ) {
    throw new Error(`Approved agent is missing ${capability}`);
  }
}

const searchToken = await agentJWT(
  agentKeys.privateKey,
  agentKid,
  registration.agent_id,
  registration.host_id,
  discovery.issuer,
  "recipes.search",
);
const searchResponse = await execute(
  discovery.endpoints.execute,
  searchToken,
  "recipes.search",
  { query: "Preview", limit: 25 },
);
if (!searchResponse.ok) {
  throw new Error(`Recipe search failed: ${await searchResponse.text()}`);
}
const search = (await searchResponse.json()) as {
  data: { items: Array<{ slug: string }> };
};
const slugs = new Set(search.data.items.map((recipe) => recipe.slug));
if (
  !slugs.has("preview-private-weeknight-pasta") ||
  !slugs.has("preview-public-tomato-toast") ||
  slugs.has("preview-admin-soup") ||
  slugs.has("preview-household-veggie-curry")
) {
  throw new Error(`Recipe search returned the wrong visibility set: ${[...slugs]}`);
}

const replay = await execute(
  discovery.endpoints.execute,
  searchToken,
  "recipes.search",
  { query: "Preview", limit: 25 },
);
if (replay.status !== 401) {
  throw new Error(`JWT replay returned ${replay.status}, expected 401`);
}

const readToken = await agentJWT(
  agentKeys.privateKey,
  agentKid,
  registration.agent_id,
  registration.host_id,
  discovery.issuer,
  "recipes.read",
);
const readResponse = await execute(
  discovery.endpoints.execute,
  readToken,
  "recipes.read",
  { slug: "preview-private-weeknight-pasta" },
);
if (!readResponse.ok) {
  throw new Error(`Recipe read failed: ${await readResponse.text()}`);
}
const read = (await readResponse.json()) as {
  data: { recipe: { body: string | null; owned: boolean; slug: string } | null };
};
if (
  read.data.recipe?.slug !== "preview-private-weeknight-pasta" ||
  read.data.recipe.owned !== true ||
  !read.data.recipe.body
) {
  throw new Error("Recipe read did not return the delegated user's private recipe");
}

console.log("Delegated agent-auth preview smoke test passed.");
