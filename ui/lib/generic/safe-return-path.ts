/**
 * Resolve an untrusted return target to a same-origin recipe route. URL
 * resolution also normalizes dot segments before the pathname is checked.
 */
export function safeRecipeReturnPath(
  value: string | null,
  origin: string,
): string | null {
  if (!value) return null;

  try {
    const url = new URL(value, origin);
    if (url.origin !== origin || !url.pathname.startsWith("/recipes/")) {
      return null;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
