import { imageSetKey } from "./image-key.js";

export function parseCsvEnv(name: string): string[] | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const values = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return values.length > 0 ? values : undefined;
}

export function mergeByImageSet<T extends { images: string[] }>(
  existing: T[],
  fresh: T[],
  targetEntryKeys: Set<string>,
): T[] {
  return [
    ...existing.filter((entry) => !targetEntryKeys.has(imageSetKey(entry.images))),
    ...fresh,
  ];
}

export function catchMissingFile<T>(fallback: T): (err: unknown) => T {
  return (err: unknown): T => {
    if (
      err instanceof Error &&
      "code" in err &&
      (err as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return fallback;
    }
    throw err;
  };
}
