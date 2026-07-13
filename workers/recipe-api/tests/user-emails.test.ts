import { describe, expect, it, vi } from "vitest";
import { verifiedEmailsFromLinkedAccount } from "../src/user-emails";

function googleIdToken(payload: Record<string, unknown>): string {
  const encoded = btoa(JSON.stringify(payload))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
  return `header.${encoded}.signature`;
}

describe("linked account emails", () => {
  it("reads a verified email from a Google ID token", async () => {
    const emails = await verifiedEmailsFromLinkedAccount({
      providerId: "google",
      userId: "user-1",
      idToken: googleIdToken({
        email: "Alias@Example.test",
        email_verified: true,
      }),
    });

    expect(emails).toEqual(["alias@example.test"]);
  });

  it("ignores an unverified email from a Google ID token", async () => {
    const emails = await verifiedEmailsFromLinkedAccount({
      providerId: "google",
      userId: "user-1",
      idToken: googleIdToken({
        email: "alias@example.test",
        email_verified: false,
      }),
    });

    expect(emails).toEqual([]);
  });

  it("keeps only verified GitHub account emails", async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify([
            { email: "First@Example.test", verified: true },
            { email: "unverified@example.test", verified: false },
            { email: "second@example.test", verified: true },
          ]),
          { status: 200 },
        ),
      ),
    );

    const emails = await verifiedEmailsFromLinkedAccount(
      {
        providerId: "github",
        userId: "user-1",
        accessToken: "token",
      },
      fetchImpl,
    );

    expect(emails).toEqual(["first@example.test", "second@example.test"]);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.github.com/user/emails",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token" }),
      }),
    );
  });
});
