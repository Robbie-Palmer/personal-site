const SESSION_COOKIE_PATTERN =
  /(?:__Secure-)?better-auth[.-]session_token=[^;,\s]+/;

export function betterAuthSessionCookie(response: Response): string {
  const cookie = response.headers
    .get("set-cookie")
    ?.match(SESSION_COOKIE_PATTERN)?.[0];
  if (!cookie) {
    throw new Error(
      `Better Auth response did not include a session cookie (${response.status})`,
    );
  }
  return cookie;
}
