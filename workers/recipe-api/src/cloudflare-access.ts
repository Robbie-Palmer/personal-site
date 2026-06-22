import { createRemoteJWKSet, jwtVerify } from "jose";

type CloudflareAccessEnv = {
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
};

const jwksByIssuer = new Map<
  string,
  ReturnType<typeof createRemoteJWKSet>
>();

function normalizeTeamDomain(value: string): string {
  const withProtocol = value.includes("://") ? value : `https://${value}`;
  const url = new URL(withProtocol);
  if (url.protocol !== "https:") {
    throw new Error("Cloudflare Access team domain must use HTTPS");
  }
  return url.origin;
}

export async function verifyCloudflareAccess(
  request: Request,
  env: CloudflareAccessEnv,
): Promise<boolean> {
  const assertion = request.headers.get("cf-access-jwt-assertion");
  if (!assertion || !env.CF_ACCESS_TEAM_DOMAIN || !env.CF_ACCESS_AUD) {
    return false;
  }

  try {
    const issuer = normalizeTeamDomain(env.CF_ACCESS_TEAM_DOMAIN);
    let jwks = jwksByIssuer.get(issuer);
    if (!jwks) {
      jwks = createRemoteJWKSet(
        new URL("/cdn-cgi/access/certs", `${issuer}/`),
      );
      jwksByIssuer.set(issuer, jwks);
    }

    await jwtVerify(assertion, jwks, {
      issuer,
      audience: env.CF_ACCESS_AUD,
    });
    return true;
  } catch {
    return false;
  }
}
