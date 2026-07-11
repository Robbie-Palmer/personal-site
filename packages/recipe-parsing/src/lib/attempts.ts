import {
  type OpenAIStyleError,
  isRetryableParseError,
} from "./parse-retry.js";
import type { ParseFailuresDataset } from "../schemas/parse-failures.js";

export type AttemptErrorDetail = NonNullable<
  ParseFailuresDataset["entries"][number]["attemptErrors"]
>[number];

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function computeBackoffDelayMs(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
): number {
  const expDelay = Math.min(baseDelayMs * 2 ** Math.max(0, attempt - 1), maxDelayMs);
  // Retry jitter needs no cryptographic strength (Sonar S2245).
  const jitterMultiplier = 0.5 + Math.random(); // NOSONAR
  return Math.floor(Math.min(expDelay * jitterMultiplier, maxDelayMs));
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

  if (!isOpenAIStyleError(error)) return base;

  if (typeof error.status === "number") {
    base.statusCode = error.status;
  }
  if (typeof error.requestID === "string" && error.requestID.length > 0) {
    base.requestId = error.requestID;
  }
  if (typeof error.code === "string" && error.code.length > 0) {
    base.providerErrorCode = error.code;
  }
  if (typeof error.type === "string" && error.type.length > 0) {
    base.providerErrorType = error.type;
  }
  if (typeof error.param === "string" && error.param.length > 0) {
    base.providerErrorParam = error.param;
  }
  if (
    typeof error.cause === "object" &&
    error.cause !== null &&
    "message" in error.cause &&
    typeof (error.cause as { message?: unknown }).message === "string"
  ) {
    base.causeMessage = (error.cause as { message: string }).message;
  }

  return base;
}
