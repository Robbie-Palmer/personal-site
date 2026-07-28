const GITHUB_API_VERSION = "2022-11-28";
const textEncoder = new TextEncoder();
const PEM_BOUNDARY = "-----";
const PRIVATE_KEY_LABEL = ["PRIVATE", "KEY"].join(" ");
const RSA_PRIVATE_KEY_LABEL = ["RSA", PRIVATE_KEY_LABEL].join(" ");

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCodePoint(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function encodeJson(value: unknown): string {
  return base64Url(textEncoder.encode(JSON.stringify(value)));
}

function derLength(length: number): Uint8Array {
  if (length < 128) return Uint8Array.of(length);
  const bytes: number[] = [];
  for (let remaining = length; remaining > 0; remaining >>= 8) {
    bytes.unshift(remaining & 0xff);
  }
  return Uint8Array.of(0x80 | bytes.length, ...bytes);
}

function derValue(tag: number, value: Uint8Array): Uint8Array {
  return Uint8Array.of(tag, ...derLength(value.length), ...value);
}

function pkcs1ToPkcs8(pkcs1: Uint8Array): Uint8Array {
  const version = Uint8Array.of(0x02, 0x01, 0x00);
  const rsaAlgorithm = Uint8Array.of(
    0x30,
    0x0d,
    0x06,
    0x09,
    0x2a,
    0x86,
    0x48,
    0x86,
    0xf7,
    0x0d,
    0x01,
    0x01,
    0x01,
    0x05,
    0x00,
  );
  return derValue(
    0x30,
    Uint8Array.of(...version, ...rsaAlgorithm, ...derValue(0x04, pkcs1)),
  );
}

function privateKeyBytes(pem: string): Uint8Array {
  const boundary = (kind: "BEGIN" | "END", label: string) =>
    `${PEM_BOUNDARY}${kind} ${label}${PEM_BOUNDARY}`;
  const isPkcs1 = pem.includes(boundary("BEGIN", RSA_PRIVATE_KEY_LABEL));
  const label = isPkcs1 ? RSA_PRIVATE_KEY_LABEL : PRIVATE_KEY_LABEL;
  const encoded = pem
    .replace(boundary("BEGIN", label), "")
    .replace(boundary("END", label), "")
    .replace(/\s/g, "");
  if (!encoded) throw new Error("GitHub App private key is empty");

  let binary: string;
  try {
    binary = atob(encoded);
  } catch {
    throw new Error("GitHub App private key is not valid PEM");
  }
  const bytes = Uint8Array.from(binary, (character) =>
    character.codePointAt(0) ?? 0,
  );
  return isPkcs1 ? pkcs1ToPkcs8(bytes) : bytes;
}

export async function createGitHubAppJwt(
  appId: string,
  privateKeyPem: string,
  now = Date.now(),
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBytes(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const issuedAt = Math.floor(now / 1_000) - 60;
  const unsigned = [
    encodeJson({ alg: "RS256", typ: "JWT" }),
    encodeJson({ iat: issuedAt, exp: issuedAt + 600, iss: appId }),
  ].join(".");
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    textEncoder.encode(unsigned),
  );
  return `${unsigned}.${base64Url(new Uint8Array(signature))}`;
}

export async function createInstallationToken(options: {
  appId: string;
  installationId: string;
  privateKey: string;
}): Promise<string> {
  const jwt = await createGitHubAppJwt(options.appId, options.privateKey);
  const response = await fetch(
    `https://api.github.com/app/installations/${encodeURIComponent(options.installationId)}/access_tokens`,
    {
      method: "POST",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${jwt}`,
        "content-type": "application/json",
        "user-agent": "personal-site-stateful-ai-review/1",
        "x-github-api-version": GITHUB_API_VERSION,
      },
      body: "{}",
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(
      `GitHub App installation-token request failed (${response.status}): ${detail}`,
    );
  }
  const payload = (await response.json()) as { token?: unknown };
  if (typeof payload.token !== "string" || payload.token.length === 0) {
    throw new Error("GitHub App installation-token response had no token");
  }
  return payload.token;
}
