import {
  type OpenAIStyleError,
  isRetryableParseError,
} from "./parse-retry.js";
import { imageSetKey } from "./image-key.js";
import type { ParseFailuresDataset } from "../schemas/parse-failures.js";

export type AttemptErrorDetail = NonNullable<
  ParseFailuresDataset["entries"][number]["attemptErrors"]
>[number];

export function parseCsvEnv(name: string): string[] | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const values = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return values.length > 0 ? values : undefined;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function computeBackoffDelayMs(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
): number {
  const expDelay = Math.min(baseDelayMs * 2 ** Math.max(0, attempt - 1), maxDelayMs);
  const jitterMultiplier = 0.5 + Math.random();
  return Math.floor(expDelay * jitterMultiplier);
}

export function isOpenAIStyleError(error: unknown): error is OpenAIStyleError {
  if (!error || typeof error !== "object") {
    return false;
  }
  return (
    "status" in error ||
    "requestID" in error ||
    "error" in error ||
    "code" in error ||
    "type" in error ||
    "param" in error
  );
}

export function extractAttemptErrorDetail(
  error: unknown,
  attempt: number,
): AttemptErrorDetail {
  const base: AttemptErrorDetail = {
    attempt,
    retryable: isRetryableParseError(error),
    errorType: error instanceof Error && error.name ? error.name : "ParseError",
    errorMessage: error instanceof Error ? error.message : String(error),
  };

  const candidate = isOpenAIStyleError(error) ? error : undefined;
  if (candidate && typeof candidate.status === "number") {
    base.statusCode = candidate.status;
  }
  if (
    candidate &&
    typeof candidate.requestID === "string" &&
    candidate.requestID.length > 0
  ) {
    base.requestId = candidate.requestID;
  }
  if (candidate && typeof candidate.code === "string" && candidate.code.length > 0) {
    base.providerErrorCode = candidate.code;
  }
  if (candidate && typeof candidate.type === "string" && candidate.type.length > 0) {
    base.providerErrorType = candidate.type;
  }
  if (candidate && typeof candidate.param === "string" && candidate.param.length > 0) {
    base.providerErrorParam = candidate.param;
  }
  if (
    candidate &&
    typeof candidate.cause === "object" &&
    candidate.cause !== null &&
    "message" in candidate.cause &&
    typeof (candidate.cause as { message?: unknown }).message === "string"
  ) {
    base.causeMessage = (candidate.cause as { message: string }).message;
  }

  return base;
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
