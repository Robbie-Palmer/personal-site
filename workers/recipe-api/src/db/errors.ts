export function hasPostgresErrorCode(
  error: unknown,
  expectedCode: string,
): boolean {
  const visited = new Set<object>();
  let current = error;

  while (typeof current === "object" && current !== null) {
    if (visited.has(current)) return false;
    visited.add(current);
    const record = current as Record<string, unknown>;

    if (Object.hasOwn(record, "code") && record.code === expectedCode)
      return true;
    current = Object.hasOwn(record, "cause") ? record.cause : undefined;
  }

  return false;
}
