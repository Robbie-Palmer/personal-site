import { describe, expect, it, vi } from "vitest";
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
  ])("extracts a Better Auth session cookie", async (header, expected) => {
    const response = new Response(null, {
      headers: { "set-cookie": header },
    });

    await expect(betterAuthSessionCookie(response)).resolves.toBe(expected);
  });

  it.each([
    null,
    "unrelated=value; Path=/",
    "better-auth/session_token=invalid-delimiter",
  ])(
    "rejects a response without a Better Auth session cookie",
    async (header) => {
      const response = new Response(null, {
        status: 401,
        headers: header ? { "set-cookie": header } : undefined,
      });

      await expect(betterAuthSessionCookie(response)).rejects.toThrow(
        "Better Auth response did not include a session cookie (401)",
      );
    },
  );

  it("does not let response cleanup mask a cookie parsing error", async () => {
    const response = new Response("unused", { status: 401 });
    vi.spyOn(response.body!, "cancel").mockRejectedValue(
      new Error("cleanup failed"),
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(betterAuthSessionCookie(response)).rejects.toThrow(
      "Better Auth response did not include a session cookie (401)",
    );
    expect(warn).toHaveBeenCalledWith(
      "Better Auth response body cleanup failed",
      expect.any(Error),
    );
  });
});
