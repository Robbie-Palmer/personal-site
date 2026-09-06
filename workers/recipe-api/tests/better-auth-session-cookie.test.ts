import { describe, expect, it } from "vitest";
import { betterAuthSessionCookie } from "../src/better-auth-session-cookie";

describe("betterAuthSessionCookie", () => {
  it.each([
    [
      "better-auth.session_token=plain-token; Path=/; HttpOnly",
      "better-auth.session_token=plain-token",
    ],
    [
      "__Secure-better-auth.session_token=secure-token; Path=/; Secure",
      "__Secure-better-auth.session_token=secure-token",
    ],
    [
      "better-auth-session_token=legacy-token; Path=/",
      "better-auth-session_token=legacy-token",
    ],
  ])("extracts a Better Auth session cookie", (header, expected) => {
    const response = new Response(null, {
      headers: { "set-cookie": header },
    });

    expect(betterAuthSessionCookie(response)).toBe(expected);
  });

  it.each([null, "unrelated=value; Path=/"])(
    "rejects a response without a Better Auth session cookie",
    (header) => {
      const response = new Response(null, {
        status: 401,
        headers: header ? { "set-cookie": header } : undefined,
      });

      expect(() => betterAuthSessionCookie(response)).toThrow(
        "Better Auth response did not include a session cookie (401)",
      );
    },
  );
});
