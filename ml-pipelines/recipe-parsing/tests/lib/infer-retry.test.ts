import { describe, expect, it } from "vitest";
import { isRetryableInferError } from "../../src/lib/infer-retry.js";

describe("isRetryableInferError", () => {
  it("retries the known transient provider 400 nesting-depth error", () => {
    const error = new Error("400 Provider returned error") as Error & {
      status?: number;
      error?: unknown;
    };
    error.status = 400;
    error.error = {
      message: "Provider returned error",
      metadata: {
        raw: JSON.stringify({
          error: {
            message:
              "A schema in GenerationConfig in the request exceeds the maximum allowed nesting depth.",
          },
        }),
      },
    };

    expect(isRetryableInferError(error)).toBe(true);
  });

  it("does not retry generic 400 bad request errors", () => {
    const error = new Error("Bad request") as Error & { status?: number };
    error.status = 400;
    expect(isRetryableInferError(error)).toBe(false);
  });

  it("retries 429 and 5xx", () => {
    const rateLimit = new Error("Rate limited") as Error & { status?: number };
    rateLimit.status = 429;
    const serverError = new Error("Server error") as Error & { status?: number };
    serverError.status = 503;

    expect(isRetryableInferError(rateLimit)).toBe(true);
    expect(isRetryableInferError(serverError)).toBe(true);
  });

  it("retries errors without a numeric status (e.g. network errors)", () => {
    const networkError = new Error("ECONNRESET");
    expect(isRetryableInferError(networkError)).toBe(true);
  });
});
