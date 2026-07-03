import { beforeEach, describe, expect, it, vi } from "vitest";

const joseMocks = vi.hoisted(() => ({
  jwks: vi.fn(),
  createRemoteJWKSet: vi.fn(),
  jwtVerify: vi.fn(),
}));

vi.mock("jose", () => ({
  createRemoteJWKSet: joseMocks.createRemoteJWKSet,
  jwtVerify: joseMocks.jwtVerify,
}));

let verifyCloudflareAccess: typeof import(
  "../src/cloudflare-access"
).verifyCloudflareAccess;

function request(assertion?: string): Request {
  return new Request("https://recipe-api.example.test/api/auth/preview", {
    headers: assertion ? { "cf-access-jwt-assertion": assertion } : undefined,
  });
}

describe("verifyCloudflareAccess", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    joseMocks.createRemoteJWKSet.mockReturnValue(joseMocks.jwks);
    joseMocks.jwtVerify.mockResolvedValue({ payload: { sub: "tester" } });
    ({ verifyCloudflareAccess } = await import("../src/cloudflare-access"));
  });

  it.each([
    [
      "assertion",
      request(),
      {
        CF_ACCESS_TEAM_DOMAIN: "missing-assertion.cloudflareaccess.com",
        CF_ACCESS_AUD: "preview-audience",
      },
    ],
    ["team domain", request("token"), { CF_ACCESS_AUD: "preview-audience" }],
    [
      "audience",
      request("token"),
      {
        CF_ACCESS_TEAM_DOMAIN: "missing-audience.cloudflareaccess.com",
      },
    ],
  ])("returns false when the %s is missing", async (_name, req, env) => {
    await expect(verifyCloudflareAccess(req, env)).resolves.toBe(false);
    expect(joseMocks.jwtVerify).not.toHaveBeenCalled();
  });

  it("verifies the assertion against the normalized issuer and configured audience", async () => {
    await expect(
      verifyCloudflareAccess(request("valid-token"), {
        CF_ACCESS_TEAM_DOMAIN: "team-a.cloudflareaccess.com",
        CF_ACCESS_AUD: "preview-audience",
      }),
    ).resolves.toBe(true);

    expect(joseMocks.createRemoteJWKSet).toHaveBeenCalledWith(
      new URL("https://team-a.cloudflareaccess.com/cdn-cgi/access/certs"),
    );
    expect(joseMocks.jwtVerify).toHaveBeenCalledWith(
      "valid-token",
      joseMocks.jwks,
      {
        issuer: "https://team-a.cloudflareaccess.com",
        audience: "preview-audience",
      },
    );
  });

  it("accepts a team domain that already includes https", async () => {
    await expect(
      verifyCloudflareAccess(request("valid-token"), {
        CF_ACCESS_TEAM_DOMAIN: "https://team-b.cloudflareaccess.com",
        CF_ACCESS_AUD: "preview-audience",
      }),
    ).resolves.toBe(true);

    expect(joseMocks.jwtVerify).toHaveBeenCalledWith(
      "valid-token",
      joseMocks.jwks,
      expect.objectContaining({
        issuer: "https://team-b.cloudflareaccess.com",
      }),
    );
  });

  it("returns false when the team domain is not HTTPS", async () => {
    await expect(
      verifyCloudflareAccess(request("token"), {
        CF_ACCESS_TEAM_DOMAIN: "http://team-c.cloudflareaccess.com",
        CF_ACCESS_AUD: "preview-audience",
      }),
    ).resolves.toBe(false);

    expect(joseMocks.jwtVerify).not.toHaveBeenCalled();
  });

  it("returns false when JWT verification fails", async () => {
    joseMocks.jwtVerify.mockRejectedValueOnce(new Error("expired"));

    await expect(
      verifyCloudflareAccess(request("expired-token"), {
        CF_ACCESS_TEAM_DOMAIN: "team-d.cloudflareaccess.com",
        CF_ACCESS_AUD: "preview-audience",
      }),
    ).resolves.toBe(false);
  });

  it("reuses the JWKS for repeated checks against the same issuer", async () => {
    const env = {
      CF_ACCESS_TEAM_DOMAIN: "team-e.cloudflareaccess.com",
      CF_ACCESS_AUD: "preview-audience",
    };

    await expect(
      verifyCloudflareAccess(request("first-token"), env),
    ).resolves.toBe(true);
    await expect(
      verifyCloudflareAccess(request("second-token"), env),
    ).resolves.toBe(true);

    expect(joseMocks.createRemoteJWKSet).toHaveBeenCalledOnce();
    expect(joseMocks.jwtVerify).toHaveBeenCalledTimes(2);
  });
});
