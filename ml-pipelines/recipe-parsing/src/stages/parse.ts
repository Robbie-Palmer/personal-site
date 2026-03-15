import "dotenv/config";
import {
  PARSE_FAILURES_PATH,
  loadParseFailures,
  loadPredictions,
  loadPreparedData,
  PREDICTIONS_PATH,
  writeJson,
} from "../lib/io";
import {
  type OpenAIStyleError,
  isRetryableParseError,
  stringifyProviderErrorBody,
} from "../lib/parse-retry.js";
import { imageSetKey } from "../lib/image-key.js";
import { parseRecipeFromImages } from "../lib/openrouter.js";
import type {
  PredictionEntry,
  PredictionsDataset,
} from "../schemas/ground-truth";
import type { ParseFailuresDataset } from "../schemas/parse-failures.js";

type AttemptErrorDetail = NonNullable<
  ParseFailuresDataset["entries"][number]["attemptErrors"]
>[number];

function parseIntegerEnv(
  name: string,
  fallback: number,
  minValue: number,
  errorMessage: string,
): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < minValue) {
    throw new Error(errorMessage);
  }
  return parsed;
}

function parsePositiveIntegerEnv(name: string, fallback: number): number {
  return parseIntegerEnv(name, fallback, 1, `${name} must be a positive integer`);
}

function parseNonNegativeIntegerEnv(name: string, fallback: number): number {
  return parseIntegerEnv(name, fallback, 0, `${name} must be a non-negative integer`);
}

function parseCsvEnv(name: string): string[] | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const values = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return values.length > 0 ? values : undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeBackoffDelayMs(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
): number {
  const expDelay = Math.min(baseDelayMs * 2 ** Math.max(0, attempt - 1), maxDelayMs);
  const jitterMultiplier = 0.5 + Math.random();
  return Math.floor(expDelay * jitterMultiplier);
}

function extractAttemptErrorDetail(
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

function isOpenAIStyleError(error: unknown): error is OpenAIStyleError {
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

type ParseResult =
  | { ok: true; prediction: PredictionEntry }
  | { ok: false; failure: ParseFailuresDataset["entries"][number] };

async function parseEntryWithRetries(params: {
  images: string[];
  model: string;
  requestTimeoutMs: number;
  maxRetries: number;
  maxImageDimension: number;
  jpegQuality: number;
  backoffBaseDelayMs: number;
  backoffMaxDelayMs: number;
}): Promise<ParseResult> {
  const attempts = params.maxRetries + 1;
  let lastError: unknown;
  const attemptErrors: AttemptErrorDetail[] = [];

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const predicted = await parseRecipeFromImages({
        imageFiles: params.images,
        model: params.model,
        requestTimeoutMs: params.requestTimeoutMs,
        maxImageDimension: params.maxImageDimension,
        jpegQuality: params.jpegQuality,
      });
      return {
        ok: true,
        prediction: {
          images: params.images,
          predicted,
        },
      };
    } catch (error) {
      lastError = error;
      const detail = extractAttemptErrorDetail(error, attempt);
      attemptErrors.push(detail);
      const diagnostics: string[] = [];
      if (detail.statusCode !== undefined) diagnostics.push(`status=${detail.statusCode}`);
      if (detail.requestId) diagnostics.push(`request_id=${detail.requestId}`);
      if (detail.providerErrorCode) diagnostics.push(`code=${detail.providerErrorCode}`);
      if (detail.providerErrorType) diagnostics.push(`type=${detail.providerErrorType}`);
      const diagnosticSuffix =
        diagnostics.length > 0 ? ` (${diagnostics.join(", ")})` : "";
      console.warn(
        `Parsing failed for [${params.images.join(", ")}] attempt ${attempt}/${attempts}: ${detail.errorMessage}${diagnosticSuffix}`,
      );
      const hasNextAttempt = attempt < attempts;
      if (hasNextAttempt && detail.retryable) {
        const delayMs = computeBackoffDelayMs(
          attempt,
          params.backoffBaseDelayMs,
          params.backoffMaxDelayMs,
        );
        console.log(
          `Retrying [${params.images.join(", ")}] in ${delayMs}ms...`,
        );
        await sleep(delayMs);
      }
      if (hasNextAttempt && !detail.retryable) {
        break;
      }
    }
  }

  const attemptCount = attemptErrors.length;
  const lastDetail =
    attemptErrors[attemptErrors.length - 1] ??
    extractAttemptErrorDetail(lastError, attemptCount || attempts);
  const candidate = isOpenAIStyleError(lastError) ? lastError : undefined;

  return {
    ok: false,
    failure: {
      images: params.images,
      attemptCount,
      model: params.model,
      errorType: lastDetail.errorType,
      errorMessage: lastDetail.errorMessage,
      statusCode: lastDetail.statusCode,
      requestId: lastDetail.requestId,
      providerErrorCode: lastDetail.providerErrorCode,
      providerErrorType: lastDetail.providerErrorType,
      providerErrorParam: lastDetail.providerErrorParam,
      providerErrorBody: stringifyProviderErrorBody(candidate?.error),
      causeMessage: lastDetail.causeMessage,
      attemptErrors,
    },
  };
}

async function main() {
  const model = process.env.OPENROUTER_MODEL ?? "google/gemini-3-flash-preview";
  const requestTimeoutMs = parsePositiveIntegerEnv("PARSE_REQUEST_TIMEOUT_MS", 30_000);
  const maxRetries = parseNonNegativeIntegerEnv("PARSE_MAX_RETRIES", 2);
  const concurrency = parsePositiveIntegerEnv("PARSE_CONCURRENCY", 8);
  const maxImageDimension = parsePositiveIntegerEnv("PARSE_IMAGE_MAX_DIM", 1600);
  const jpegQuality = parsePositiveIntegerEnv("PARSE_IMAGE_JPEG_QUALITY", 80);
  if (jpegQuality > 100) {
    throw new Error("PARSE_IMAGE_JPEG_QUALITY must be <= 100");
  }
  const backoffBaseDelayMs = parsePositiveIntegerEnv(
    "PARSE_RETRY_BASE_DELAY_MS",
    500,
  );
  const backoffMaxDelayMs = parsePositiveIntegerEnv(
    "PARSE_RETRY_MAX_DELAY_MS",
    8_000,
  );
  const targetImages = parseCsvEnv("PARSE_TARGET_IMAGES");
  const hasApiKey = Boolean(process.env.OPENROUTER_API_KEY);

  console.log("Parse config:");
  console.log(`  OPENROUTER_MODEL:          ${model}`);
  console.log(`  PARSE_REQUEST_TIMEOUT_MS:  ${requestTimeoutMs}`);
  console.log(`  PARSE_MAX_RETRIES:         ${maxRetries}`);
  console.log(`  PARSE_CONCURRENCY:         ${concurrency}`);
  console.log(`  PARSE_RETRY_BASE_DELAY_MS: ${backoffBaseDelayMs}`);
  console.log(`  PARSE_RETRY_MAX_DELAY_MS:  ${backoffMaxDelayMs}`);
  console.log(`  PARSE_IMAGE_MAX_DIM:       ${maxImageDimension}`);
  console.log(`  PARSE_IMAGE_JPEG_QUALITY:  ${jpegQuality}`);
  console.log(
    `  PARSE_TARGET_IMAGES:       ${targetImages ? targetImages.join(", ") : "(all entries)"}`,
  );
  console.log(`  OPENROUTER_API_KEY:        ${hasApiKey ? "set" : "missing"}`);

  console.log("Loading prepared data...");
  const prepared = await loadPreparedData();
  let entriesToProcess = prepared.entries;
  let targetEntryKeys = new Set<string>();

  if (targetImages) {
    const targetSet = new Set(targetImages);
    const matches = prepared.entries.filter((entry) => {
      if (entry.images.length !== targetImages.length) return false;
      return entry.images.every((image) => targetSet.has(image));
    });
    if (matches.length === 0) {
      const available = prepared.entries
        .map((entry) => entry.images.join(", "))
        .sort()
        .join("\n  - ");
      throw new Error(
        `No prepared entry matched PARSE_TARGET_IMAGES=${targetImages.join(", ")}.\nAvailable image sets:\n  - ${available}`,
      );
    }
    entriesToProcess = matches;
    targetEntryKeys = new Set(matches.map((entry) => imageSetKey(entry.images)));
  }

  console.log(
    `Running OpenRouter parsing with model '${model}' on ${entriesToProcess.length} entries...`,
  );

  const results = new Array<ParseResult | undefined>(entriesToProcess.length);
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= entriesToProcess.length) {
        return;
      }
      const entry = entriesToProcess[currentIndex]!;
      results[currentIndex] = await parseEntryWithRetries({
        images: entry.images,
        model,
        requestTimeoutMs,
        maxRetries,
        maxImageDimension,
        jpegQuality,
        backoffBaseDelayMs,
        backoffMaxDelayMs,
      });
    }
  };

  const workerCount = Math.min(concurrency, Math.max(entriesToProcess.length, 1));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  const predictions: PredictionsDataset = { entries: [] };
  const failures: ParseFailuresDataset = { entries: [] };
  for (const result of results) {
    if (!result) continue;
    if (result.ok) {
      predictions.entries.push(result.prediction);
    } else {
      failures.entries.push(result.failure);
    }
  }

  if (targetImages) {
    let existingPredictions: PredictionsDataset = { entries: [] };
    let existingFailures: ParseFailuresDataset;
    try {
      existingPredictions = await loadPredictions();
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
        existingPredictions = { entries: [] };
      } else {
        throw error;
      }
    }
    existingFailures = await loadParseFailures();

    predictions.entries = [
      ...existingPredictions.entries.filter(
        (entry) => !targetEntryKeys.has(imageSetKey(entry.images)),
      ),
      ...predictions.entries,
    ];
    failures.entries = [
      ...existingFailures.entries.filter(
        (entry) => !targetEntryKeys.has(imageSetKey(entry.images)),
      ),
      ...failures.entries,
    ];
  }

  await Promise.all([
    writeJson(PREDICTIONS_PATH, predictions),
    writeJson(PARSE_FAILURES_PATH, failures),
  ]);
  console.log(
    `Generated ${predictions.entries.length} predictions, ${failures.entries.length} failures → ${PREDICTIONS_PATH}`,
  );
  console.log(`Parse failures written to ${PARSE_FAILURES_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
