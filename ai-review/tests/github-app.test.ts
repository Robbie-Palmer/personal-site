import { generateKeyPairSync } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createInstallationToken } from "../src/github-app";

const keyPair = generateKeyPairSync("rsa", { modulusLength: 2048 });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createInstallationToken", () => {
  const privateKey = keyPair.privateKey
    .export({ type: "pkcs8", format: "pem" })
    .toString();

  it("exchanges the signed App JWT without exposing it in the body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({
          token: "installation-token",
          expires_at: "2026-07-28T13:00:00Z",
          permissions: {},
          repository_selection: "selected",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createInstallationToken({
        appId: "123",
        installationId: "456",
        privateKey,
      }),
    ).resolves.toBe("installation-token");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/app/installations/456/access_tokens"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: expect.stringMatching(/^bearer [^.]+\.[^.]+\.[^.]+$/i),
        }),
      }),
    );
  });

  it("rejects failed exchanges", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("denied", { status: 401 })),
    );
    await expect(
      createInstallationToken({
        appId: "123",
        installationId: "456",
        privateKey,
      }),
    ).rejects.toThrow("denied");
  });

  it("requires deployment-time PKCS#1 to PKCS#8 conversion", async () => {
    const pkcs1 = keyPair.privateKey
      .export({ type: "pkcs1", format: "pem" })
      .toString();
    await expect(
      createInstallationToken({
        appId: "123",
        installationId: "456",
        privateKey: pkcs1,
      }),
    ).rejects.toThrow("must be unencrypted PKCS#8 PEM");
  });
});
