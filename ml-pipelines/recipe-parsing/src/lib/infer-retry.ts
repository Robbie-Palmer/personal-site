export const MAX_PROVIDER_ERROR_BODY_CHARS = 3_000;

export type OpenAIStyleError = Error & {
  status?: number;
  requestID?: string | null;
  code?: string | null;
  type?: string;
  param?: string | null;
  error?: unknown;
  cause?: unknown;
};

export function stringifyProviderErrorBody(errorBody: unknown): string | undefined {
  if (errorBody === undefined) return undefined;
  let raw: string;
  if (typeof errorBody === "string") {
    raw = errorBody;
  } else {
    try {
      raw = JSON.stringify(errorBody, null, 2);
    } catch {
      raw = "[unserializable error body]";
    }
  }
  if (raw.length <= MAX_PROVIDER_ERROR_BODY_CHARS) {
    return raw;
  }
  return `${raw.slice(0, MAX_PROVIDER_ERROR_BODY_CHARS)}...`;
}

function errorText(error: unknown): string {
  if (!(error instanceof Error)) return String(error).toLowerCase();
  const candidate = error as OpenAIStyleError;
  const message = error.message ?? "";
  const providerErrorText =
    candidate.error === undefined
      ? ""
      : (stringifyProviderErrorBody(candidate.error) ?? "");
  return `${message}\n${providerErrorText}`.toLowerCase();
}

function isTransientProvider400Error(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const maybeStatus = (error as { status?: unknown }).status;
  if (maybeStatus !== 400) return false;

  const text = errorText(error);
  // Observed intermittent provider-side validator glitch via OpenRouter/Google.
  return (
    text.includes("provider returned error") &&
    text.includes("maximum allowed nesting depth")
  );
}

export function isRetryableInferError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const maybeStatus = (error as { status?: unknown }).status;
  if (typeof maybeStatus === "number") {
    if (isTransientProvider400Error(error)) {
      return true;
    }
    return maybeStatus === 429 || (maybeStatus >= 500 && maybeStatus < 600);
  }
  // Fail-open for transport-level failures (e.g. ECONNRESET/ETIMEDOUT) that
  // often lack HTTP status codes. isTransientProvider400Error handles the known
  // provider-side 400 nesting-depth glitch separately above.
  return true;
}
