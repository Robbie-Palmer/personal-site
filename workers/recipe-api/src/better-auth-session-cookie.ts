const SESSION_COOKIE_PATTERN =
  /(?:__Secure-)?better-auth[.-]session_token=[^;,\s]+/;

export async function betterAuthSessionCookie(
  response: Response,
): Promise<string> {
  try {
    const cookie = response.headers
      .get("set-cookie")
      ?.match(SESSION_COOKIE_PATTERN)?.[0];
    if (!cookie) {
      throw new Error(
        `Better Auth response did not include a session cookie (${response.status})`,
      );
    }
    return cookie;
  } finally {
    try {
      await response.body?.cancel();
    } catch (error) {
      console.warn("Better Auth response body cleanup failed", error);
    }
  }
}
