import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { verifyCloudflareAccess } from "../src/cloudflare-access";

vi.mock("jose", () => ({
  createRemoteJWKSet: vi.fn(() => vi.fn()),
  jwtVerify: vi.fn(() => Promise.resolve({ payload: { sub: "tester" } })),
}));

const baseEnv = {
  CF_ACCESS_TEAM_DOMAIN: "example.cloudflareaccess.com",
  CF_ACCESS_AUD: "test-audience",
};

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("https://example.workers.dev/api/auth/preview/scenarios", {
    headers,
  });
}

describe("verifyCloudflareAccess", () => {
  beforeEach(() => {
    vi.mocked(jwtVerify).mockResolvedValue({
      payload: { sub: "tester" },
    } as Awaited<ReturnType<typeof jwtVerify>>);
    vi.mocked(createRemoteJWKSet).mockReturnValue(vi.fn() as ReturnType<typeof createRemoteJWKSet>);
  });

  it("returns false when the cf-access-jwt-assertion header is absent", async () => {
    const result = await verifyCloudflareAccess(makeRequest(), baseEnv);
    expect(result).toBe(false);
  });

  it("returns false when CF_ACCESS_TEAM_DOMAIN is missing", async () => {
    const result = await verifyCloudflareAccess(
      makeRequest({ "cf-access-jwt-assertion": "token" }),
      { CF_ACCESS_AUD: baseEnv.CF_ACCESS_AUD },
    );
    expect(result).toBe(false);
  });

  it("returns false when CF_ACCESS_AUD is missing", async () => {
    const result = await verifyCloudflareAccess(
      makeRequest({ "cf-access-jwt-assertion": "token" }),
      { CF_ACCESS_TEAM_DOMAIN: baseEnv.CF_ACCESS_TEAM_DOMAIN },
    );
    expect(result).toBe(false);
  });

  it("returns false when both env vars are absent", async () => {
    const result = await verifyCloudflareAccess(
      makeRequest({ "cf-access-jwt-assertion": "token" }),
      {},
    );
    expect(result).toBe(false);
  });

  it("returns true when jwtVerify succeeds", async () => {
    const result = await verifyCloudflareAccess(
      makeRequest({ "cf-access-jwt-assertion": "valid-token" }),
      baseEnv,
    );
    expect(result).toBe(true);
  });

  it("returns false when jwtVerify throws (invalid token)", async () => {
    vi.mocked(jwtVerify).mockRejectedValueOnce(new Error("JWTExpired"));
    const result = await verifyCloudflareAccess(
      makeRequest({ "cf-access-jwt-assertion": "expired-token" }),
      baseEnv,
    );
    expect(result).toBe(false);
  });

  it("passes the assertion token to jwtVerify", async () => {
    await verifyCloudflareAccess(
      makeRequest({ "cf-access-jwt-assertion": "my-assertion-jwt" }),
      baseEnv,
    );
    expect(jwtVerify).toHaveBeenCalledWith(
      "my-assertion-jwt",
      expect.any(Function),
      expect.objectContaining({ audience: baseEnv.CF_ACCESS_AUD }),
    );
  });

  it("passes the normalized issuer to jwtVerify", async () => {
    await verifyCloudflareAccess(
      makeRequest({ "cf-access-jwt-assertion": "token" }),
      baseEnv,
    );
    expect(jwtVerify).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Function),
      expect.objectContaining({
        issuer: "https://example.cloudflareaccess.com",
      }),
    );
  });

  it("normalizes a team domain supplied without a protocol prefix", async () => {
    await verifyCloudflareAccess(
      makeRequest({ "cf-access-jwt-assertion": "token" }),
      { ...baseEnv, CF_ACCESS_TEAM_DOMAIN: "my-team.cloudflareaccess.com" },
    );
    expect(jwtVerify).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Function),
      expect.objectContaining({
        issuer: "https://my-team.cloudflareaccess.com",
      }),
    );
  });

  it("accepts a team domain already prefixed with https://", async () => {
    await verifyCloudflareAccess(
      makeRequest({ "cf-access-jwt-assertion": "token" }),
      {
        ...baseEnv,
        CF_ACCESS_TEAM_DOMAIN: "https://example.cloudflareaccess.com",
      },
    );
    expect(jwtVerify).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Function),
      expect.objectContaining({
        issuer: "https://example.cloudflareaccess.com",
      }),
    );
  });

  it("returns false when the team domain uses a non-HTTPS protocol", async () => {
    const result = await verifyCloudflareAccess(
      makeRequest({ "cf-access-jwt-assertion": "token" }),
      { ...baseEnv, CF_ACCESS_TEAM_DOMAIN: "http://insecure.cloudflareaccess.com" },
    );
    expect(result).toBe(false);
  });

  it("creates the JWKS endpoint from the team domain origin", async () => {
    await verifyCloudflareAccess(
      makeRequest({ "cf-access-jwt-assertion": "token" }),
      baseEnv,
    );
    expect(createRemoteJWKSet).toHaveBeenCalledWith(
      expect.objectContaining({
        href: expect.stringContaining("/cdn-cgi/access/certs"),
      }),
    );
  });

  it("reuses a cached JWKS set for the same issuer on repeated calls", async () => {
    const request = makeRequest({ "cf-access-jwt-assertion": "token" });
    await verifyCloudflareAccess(request, baseEnv);
    const callCountAfterFirst = vi.mocked(createRemoteJWKSet).mock.calls.length;
    await verifyCloudflareAccess(request, baseEnv);
    expect(vi.mocked(createRemoteJWKSet).mock.calls.length).toBe(callCountAfterFirst);
  });
});