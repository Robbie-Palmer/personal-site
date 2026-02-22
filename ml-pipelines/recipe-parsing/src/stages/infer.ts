import "dotenv/config";
import {
  INFER_FAILURES_PATH,
  loadInferFailures,
  loadPredictions,
  loadPreparedData,
  PREDICTIONS_PATH,
  writeJson,
} from "../lib/io";
import { isRetryableInferError } from "../lib/infer-retry.js";
import { inferRecipeFromImages } from "../lib/openrouter.js";
import type {
  PredictionEntry,
  PredictionsDataset,
} from "../schemas/ground-truth";
import type { InferFailuresDataset } from "../schemas/infer-failures.js";

const MAX_PROVIDER_ERROR_BODY_CHARS = 3_000;

type OpenAIStyleError = Error & {
  status?: number;
  requestID?: string | null;
  code?: string | null;
  type?: string;
  param?: string | null;
  error?: unknown;
  cause?: unknown;
};

type AttemptErrorDetail = NonNullable<
  InferFailuresDataset["entries"][number]["attemptErrors"]
>[number];

function parsePositiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function parseNonNegativeIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return parsed;
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

function stringifyProviderErrorBody(errorBody: unknown): string | undefined {
  if (errorBody === undefined) return undefined;
  const raw =
    typeof errorBody === "string"
      ? errorBody
      : JSON.stringify(errorBody, null, 2);
  if (raw.length <= MAX_PROVIDER_ERROR_BODY_CHARS) {
    return raw;
  }
  return `${raw.slice(0, MAX_PROVIDER_ERROR_BODY_CHARS)}...`;
}

function extractAttemptErrorDetail(
  error: unknown,
  attempt: number,
): AttemptErrorDetail {
  const base: AttemptErrorDetail = {
    attempt,
    retryable: isRetryableInferError(error),
    errorType: error instanceof Error && error.name ? error.name : "InferenceError",
    errorMessage: error instanceof Error ? error.message : String(error),
  };

  const candidate = error as OpenAIStyleError;
  if (typeof candidate.status === "number") {
    base.statusCode = candidate.status;
  }
  if (typeof candidate.requestID === "string" && candidate.requestID.length > 0) {
    base.requestId = candidate.requestID;
  }
  if (typeof candidate.code === "string" && candidate.code.length > 0) {
    base.providerErrorCode = candidate.code;
  }
  if (typeof candidate.type === "string" && candidate.type.length > 0) {
    base.providerErrorType = candidate.type;
  }
  if (typeof candidate.param === "string" && candidate.param.length > 0) {
    base.providerErrorParam = candidate.param;
  }
  if (
    typeof candidate.cause === "object" &&
    candidate.cause !== null &&
    "message" in candidate.cause &&
    typeof (candidate.cause as { message?: unknown }).message === "string"
  ) {
    base.causeMessage = (candidate.cause as { message: string }).message;
  }

  return base;
}

type InferResult =
  | { ok: true; prediction: PredictionEntry }
  | { ok: false; failure: InferFailuresDataset["entries"][number] };

async function inferEntryWithRetries(params: {
  images: string[];
  model: string;
  maxRetries: number;
  maxImageDimension: number;
  jpegQuality: number;
  backoffBaseDelayMs: number;
  backoffMaxDelayMs: number;
}): Promise<InferResult> {
  const attempts = params.maxRetries + 1;
  let lastError: unknown;
  const attemptErrors: AttemptErrorDetail[] = [];

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const predicted = await inferRecipeFromImages({
        imageFiles: params.images,
        model: params.model,
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
        `Inference failed for [${params.images.join(", ")}] attempt ${attempt}/${attempts}: ${detail.errorMessage}${diagnosticSuffix}`,
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
    }
  }

  const lastDetail =
    attemptErrors[attemptErrors.length - 1] ?? extractAttemptErrorDetail(lastError, attempts);
  const candidate = lastError as OpenAIStyleError;

  return {
    ok: false,
    failure: {
      images: params.images,
      attemptCount: attempts,
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
  const maxRetries = parseNonNegativeIntegerEnv("INFER_MAX_RETRIES", 2);
  const concurrency = parsePositiveIntegerEnv("INFER_CONCURRENCY", 8);
  const maxImageDimension = parsePositiveIntegerEnv("INFER_IMAGE_MAX_DIM", 1600);
  const jpegQuality = parsePositiveIntegerEnv("INFER_IMAGE_JPEG_QUALITY", 80);
  const backoffBaseDelayMs = parsePositiveIntegerEnv(
    "INFER_RETRY_BASE_DELAY_MS",
    500,
  );
  const backoffMaxDelayMs = parsePositiveIntegerEnv(
    "INFER_RETRY_MAX_DELAY_MS",
    8_000,
  );
  const targetImages = parseCsvEnv("INFER_TARGET_IMAGES");
  const hasApiKey = Boolean(process.env.OPENROUTER_API_KEY);

  console.log("Inference config:");
  console.log(`  OPENROUTER_MODEL:        ${model}`);
  console.log(`  INFER_MAX_RETRIES:       ${maxRetries}`);
  console.log(`  INFER_CONCURRENCY:       ${concurrency}`);
  console.log(`  INFER_RETRY_BASE_DELAY_MS:${backoffBaseDelayMs}`);
  console.log(`  INFER_RETRY_MAX_DELAY_MS:${backoffMaxDelayMs}`);
  console.log(`  INFER_IMAGE_MAX_DIM:     ${maxImageDimension}`);
  console.log(`  INFER_IMAGE_JPEG_QUALITY:${jpegQuality}`);
  console.log(
    `  INFER_TARGET_IMAGES:     ${targetImages ? targetImages.join(", ") : "(all entries)"}`,
  );
  console.log(`  OPENROUTER_API_KEY:      ${hasApiKey ? "set" : "missing"}`);

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
        `No prepared entry matched INFER_TARGET_IMAGES=${targetImages.join(", ")}.\nAvailable image sets:\n  - ${available}`,
      );
    }
    entriesToProcess = matches;
    targetEntryKeys = new Set(matches.map((entry) => entry.images.join(",")));
  }

  console.log(
    `Running OpenRouter inference with model '${model}' on ${entriesToProcess.length} entries...`,
  );

  const results = new Array<InferResult | undefined>(entriesToProcess.length);
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= entriesToProcess.length) {
        return;
      }
      const entry = entriesToProcess[currentIndex]!;
      results[currentIndex] = await inferEntryWithRetries({
        images: entry.images,
        model,
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
  const failures: InferFailuresDataset = { entries: [] };
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
    let existingFailures: InferFailuresDataset = { entries: [] };
    try {
      existingPredictions = await loadPredictions();
    } catch {
      existingPredictions = { entries: [] };
    }
    try {
      existingFailures = await loadInferFailures();
    } catch {
      existingFailures = { entries: [] };
    }

    predictions.entries = [
      ...existingPredictions.entries.filter(
        (entry) => !targetEntryKeys.has(entry.images.join(",")),
      ),
      ...predictions.entries,
    ];
    failures.entries = [
      ...existingFailures.entries.filter(
        (entry) => !targetEntryKeys.has(entry.images.join(",")),
      ),
      ...failures.entries,
    ];
  }

  await Promise.all([
    writeJson(PREDICTIONS_PATH, predictions),
    writeJson(INFER_FAILURES_PATH, failures),
  ]);
  console.log(
    `Generated ${predictions.entries.length} predictions, ${failures.entries.length} failures → ${PREDICTIONS_PATH}`,
  );
  console.log(`Inference failures written to ${INFER_FAILURES_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
