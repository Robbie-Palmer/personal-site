export function hasPostgresErrorCode(
  error: unknown,
  expectedCode: string,
): boolean {
  const visited = new Set<object>();
  let current = error;

  while (typeof current === "object" && current !== null) {
    if (visited.has(current)) return false;
    visited.add(current);

    if ("code" in current && current.code === expectedCode) return true;
    current = "cause" in current ? current.cause : undefined;
  }

  return false;
}
