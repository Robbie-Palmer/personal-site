import { generateKeyPairSync, verify } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createGitHubAppJwt,
  createInstallationToken,
} from "../src/github-app";

const keyPair = generateKeyPairSync("rsa", { modulusLength: 2048 });

function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value.replaceAll("-", "+").replaceAll("_", "/"), "base64");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createGitHubAppJwt", () => {
  it.each([
    ["pkcs8", keyPair.privateKey.export({ type: "pkcs8", format: "pem" })],
    ["pkcs1", keyPair.privateKey.export({ type: "pkcs1", format: "pem" })],
  ])("signs a GitHub App JWT from a %s key", async (_type, privateKey) => {
    const jwt = await createGitHubAppJwt(
      "12345",
      privateKey.toString(),
      Date.parse("2026-07-28T12:00:00Z"),
    );
    const [encodedHeader, encodedPayload, encodedSignature] = jwt.split(".");
    expect(JSON.parse(decodeBase64Url(encodedHeader ?? "").toString())).toEqual({
      alg: "RS256",
      typ: "JWT",
    });
    expect(JSON.parse(decodeBase64Url(encodedPayload ?? "").toString())).toEqual({
      iat: 1_785_239_940,
      exp: 1_785_240_540,
      iss: "12345",
    });
    expect(
      verify(
        "RSA-SHA256",
        Buffer.from(`${encodedHeader}.${encodedPayload}`),
        keyPair.publicKey,
        decodeBase64Url(encodedSignature ?? ""),
      ),
    ).toBe(true);
  });
});

describe("createInstallationToken", () => {
  const privateKey = keyPair.privateKey
    .export({ type: "pkcs8", format: "pem" })
    .toString();

  it("exchanges the signed App JWT without exposing it in the body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ token: "installation-token" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createInstallationToken({
        appId: "123",
        installationId: "456",
        privateKey,
      }),
    ).resolves.toBe("installation-token");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/app/installations/456/access_tokens",
      expect.objectContaining({
        method: "POST",
        body: "{}",
        headers: expect.objectContaining({
          authorization: expect.stringMatching(/^Bearer [^.]+\.[^.]+\.[^.]+$/),
        }),
      }),
    );
  });

  it("rejects failed and malformed exchanges", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("denied", { status: 401 }))
        .mockResolvedValueOnce(Response.json({})),
    );
    await expect(
      createInstallationToken({
        appId: "123",
        installationId: "456",
        privateKey,
      }),
    ).rejects.toThrow("failed (401)");
    await expect(
      createInstallationToken({
        appId: "123",
        installationId: "456",
        privateKey,
      }),
    ).rejects.toThrow("had no token");
  });
});
