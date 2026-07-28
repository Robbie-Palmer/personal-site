import { describe, expect, it } from "vitest";
import { createGitHubAppAuth } from "../src/github-app";

function pem(bytes: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) {
    binary += String.fromCodePoint(byte);
  }
  const encoded = btoa(binary).match(/.{1,64}/g)?.join("\n") ?? "";
  return `-----BEGIN PRIVATE KEY-----\n${encoded}\n-----END PRIVATE KEY-----`;
}

describe("GitHub App authentication in workerd", () => {
  it("imports a PKCS#8 key and creates an Octokit App JWT", async () => {
    const pair = (await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: Uint8Array.of(1, 0, 1),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"],
    )) as CryptoKeyPair;
    const privateKey = pem(
      (await crypto.subtle.exportKey(
        "pkcs8",
        pair.privateKey,
      )) as ArrayBuffer,
    );
    const auth = createGitHubAppAuth({
      appId: "123",
      installationId: "456",
      privateKey,
    });

    const authentication = await auth({ type: "app" });

    expect(authentication.token.split(".")).toHaveLength(3);
    expect(authentication.appId).toBe("123");
  });
});
