import "dotenv/config";
import {
  COOKLANG_PREDICTIONS_PATH,
  PARSE_FAILURES_PATH,
  PREDICTIONS_PATH,
  STRUCTURED_TEXT_PREDICTIONS_PATH,
  loadCooklangPredictions,
  loadImageEntries,
  loadParseFailures,
  loadPredictions,
  loadStructuredTextPredictions,
  writeJson,
} from "../lib/io";
import {
  buildCooklangDraftFromStructuredText,
  deriveRecipeFromCooklang,
  deriveRecipeFromStructuredText,
} from "../lib/cooklang.js";
import {
  type OpenAIStyleError,
  isRetryableParseError,
  stringifyProviderErrorBody,
} from "../lib/parse-retry.js";
import { imageSetKey } from "../lib/image-key.js";
import {
  extractStructuredTextFromImages,
  generateCooklangFromStructuredText,
} from "../lib/openrouter.js";
import type {
  PredictionEntry,
  PredictionsDataset,
} from "../schemas/ground-truth.js";
import type { ParseFailuresDataset } from "../schemas/parse-failures.js";
import type {
  CooklangPredictionEntry,
  CooklangPredictionsDataset,
  StructuredTextPredictionEntry,
  StructuredTextPredictionsDataset,
} from "../schemas/stage-artifacts.js";

type AttemptErrorDetail = NonNullable<
  ParseFailuresDataset["entries"][number]["attemptErrors"]
>[number];

type ParseStage = "extract-structured" | "derive-recipe";

type ParseSuccess = {
  ok: true;
  prediction?: PredictionEntry;
  structured: StructuredTextPredictionEntry;
  cooklang: CooklangPredictionEntry;
};

type ParseFailure = {
  ok: false;
  prediction?: PredictionEntry;
  structured?: StructuredTextPredictionEntry;
  cooklang?: CooklangPredictionEntry;
  failure: ParseFailuresDataset["entries"][number];
};

type ParseResult = ParseSuccess | ParseFailure;

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

function buildFailure(params: {
  images: string[];
  stage: ParseStage;
  model?: string;
  lastError: unknown;
  attemptErrors: AttemptErrorDetail[];
  prediction?: PredictionEntry;
  structured?: StructuredTextPredictionEntry;
  cooklang?: CooklangPredictionEntry;
}): ParseFailure {
  const attemptCount = params.attemptErrors.length;
  const lastDetail =
    params.attemptErrors[params.attemptErrors.length - 1] ??
    extractAttemptErrorDetail(params.lastError, attemptCount || 1);
  const candidate = isOpenAIStyleError(params.lastError) ? params.lastError : undefined;

  return {
    ok: false,
    prediction: params.prediction,
    structured: params.structured,
    cooklang: params.cooklang,
    failure: {
      images: params.images,
      stage: params.stage,
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
      attemptErrors: params.attemptErrors,
    },
  };
}

async function parseEntryWithRetries(params: {
  images: string[];
  extractModel: string;
  cooklangModel: string;
  requestTimeoutMs: number;
  maxRetries: number;
  maxImageDimension: number;
  jpegQuality: number;
  backoffBaseDelayMs: number;
  backoffMaxDelayMs: number;
}): Promise<ParseResult> {
  const attempts = params.maxRetries + 1;
  let extractionError: unknown;
  const extractionAttemptErrors: AttemptErrorDetail[] = [];

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const extracted = await extractStructuredTextFromImages({
        imageFiles: params.images,
        model: params.extractModel,
        requestTimeoutMs: params.requestTimeoutMs,
        maxImageDimension: params.maxImageDimension,
        jpegQuality: params.jpegQuality,
      });

      const cooklangDraft = buildCooklangDraftFromStructuredText(extracted);
      let cooklang = cooklangDraft;
      try {
        cooklang = await generateCooklangFromStructuredText({
          extracted,
          model: params.cooklangModel,
          requestTimeoutMs: params.requestTimeoutMs,
        });
      } catch (error) {
        cooklang = {
          ...cooklangDraft,
          diagnostics: [
            ...cooklangDraft.diagnostics,
            `Cooklang model refinement failed; keeping deterministic draft: ${
              error instanceof Error ? error.message : String(error)
            }`,
          ],
          derived: cooklangDraft.derived,
        };
      }

      const derivedCooklang = cooklang.derived
        ? cooklang
        : deriveRecipeFromCooklang(cooklang);
      const structuredFallback = deriveRecipeFromStructuredText(extracted);
      if (!derivedCooklang.derived) {
        const fallbackPrediction = structuredFallback.recipe
          ? {
              images: params.images,
              predicted: structuredFallback.recipe,
            }
          : undefined;
        const fallbackCooklang = {
          ...derivedCooklang,
          diagnostics: [
            ...derivedCooklang.diagnostics,
            ...structuredFallback.diagnostics,
          ],
        };
        return buildFailure({
          images: params.images,
          stage: "derive-recipe",
          model: params.cooklangModel,
          lastError: new Error(
            [...derivedCooklang.diagnostics, ...structuredFallback.diagnostics].join(" | "),
          ),
          prediction: fallbackPrediction,
          structured: {
            images: params.images,
            extracted,
          },
          cooklang: {
            images: params.images,
            cooklang: fallbackCooklang,
          },
          attemptErrors: [
            extractAttemptErrorDetail(
              new Error(
                [...derivedCooklang.diagnostics, ...structuredFallback.diagnostics].join(
                  " | ",
                ),
              ),
              1,
            ),
          ],
        });
      }

      return {
        ok: true,
        prediction: derivedCooklang.derived
          ? {
              images: params.images,
              predicted: derivedCooklang.derived,
            }
          : undefined,
        structured: {
          images: params.images,
          extracted,
        },
        cooklang: {
          images: params.images,
          cooklang: derivedCooklang,
        },
      };
    } catch (error) {
      extractionError = error;
      const detail = extractAttemptErrorDetail(error, attempt);
      extractionAttemptErrors.push(detail);
      const diagnostics: string[] = [];
      if (detail.statusCode !== undefined) diagnostics.push(`status=${detail.statusCode}`);
      if (detail.requestId) diagnostics.push(`request_id=${detail.requestId}`);
      if (detail.providerErrorCode) diagnostics.push(`code=${detail.providerErrorCode}`);
      if (detail.providerErrorType) diagnostics.push(`type=${detail.providerErrorType}`);
      const diagnosticSuffix =
        diagnostics.length > 0 ? ` (${diagnostics.join(", ")})` : "";
      console.warn(
        `Structured extraction failed for [${params.images.join(", ")}] attempt ${attempt}/${attempts}: ${detail.errorMessage}${diagnosticSuffix}`,
      );
      const hasNextAttempt = attempt < attempts;
      if (hasNextAttempt && detail.retryable) {
        const delayMs = computeBackoffDelayMs(
          attempt,
          params.backoffBaseDelayMs,
          params.backoffMaxDelayMs,
        );
        console.log(`Retrying [${params.images.join(", ")}] in ${delayMs}ms...`);
        await sleep(delayMs);
      }
      if (hasNextAttempt && !detail.retryable) {
        break;
      }
    }
  }

  return buildFailure({
    images: params.images,
    stage: "extract-structured",
    model: params.extractModel,
    lastError: extractionError,
    attemptErrors: extractionAttemptErrors,
  });
}

async function main() {
  const extractModel = process.env.OPENROUTER_MODEL ?? "google/gemini-3-flash-preview";
  const cooklangModel = process.env.COOKLANG_MODEL ?? extractModel;
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
  console.log(`  OPENROUTER_MODEL:          ${extractModel}`);
  console.log(`  COOKLANG_MODEL:            ${cooklangModel}`);
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

  console.log("Loading image entries...");
  const imageEntries = await loadImageEntries();
  let entriesToProcess = imageEntries.entries;
  let targetEntryKeys = new Set<string>();

  if (targetImages) {
    const targetSet = new Set(targetImages);
    const matches = imageEntries.entries.filter((entry) => {
      if (entry.images.length !== targetImages.length) return false;
      return entry.images.every((image) => targetSet.has(image));
    });
    if (matches.length === 0) {
      const available = imageEntries.entries
        .map((entry) => entry.images.join(", "))
        .sort()
        .join("\n  - ");
      throw new Error(
        `No entry matched PARSE_TARGET_IMAGES=${targetImages.join(", ")}.\nAvailable image sets:\n  - ${available}`,
      );
    }
    entriesToProcess = matches;
    targetEntryKeys = new Set(matches.map((entry) => imageSetKey(entry.images)));
  }

  console.log(
    `Running extraction and Cooklang generation on ${entriesToProcess.length} entries...`,
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
        extractModel,
        cooklangModel,
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
  const structuredPredictions: StructuredTextPredictionsDataset = { entries: [] };
  const cooklangPredictions: CooklangPredictionsDataset = { entries: [] };
  const failures: ParseFailuresDataset = { entries: [] };

  for (const result of results) {
    if (!result) continue;
    if (result.ok) {
      if (result.prediction) {
        predictions.entries.push(result.prediction);
      }
      structuredPredictions.entries.push(result.structured);
      cooklangPredictions.entries.push(result.cooklang);
    } else {
      if (result.prediction) {
        predictions.entries.push(result.prediction);
      }
      if (result.structured) {
        structuredPredictions.entries.push(result.structured);
      }
      if (result.cooklang) {
        cooklangPredictions.entries.push(result.cooklang);
      }
      failures.entries.push(result.failure);
    }
  }

  if (targetEntryKeys.size > 0) {
    const catchMissingFile = <T,>(fallback: T) => (err: unknown): T => {
      if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
        return fallback;
      }
      throw err;
    };

    const [existingPredictions, existingFailures, existingStructured, existingCooklang] =
      await Promise.all([
        loadPredictions().catch(catchMissingFile({ entries: [] } as PredictionsDataset)),
        loadParseFailures().catch(catchMissingFile({ entries: [] } as ParseFailuresDataset)),
        loadStructuredTextPredictions().catch(catchMissingFile({ entries: [] } as StructuredTextPredictionsDataset)),
        loadCooklangPredictions().catch(catchMissingFile({ entries: [] } as CooklangPredictionsDataset)),
      ]);

    const mergedPredictions = existingPredictions.entries.filter(
      (entry) => !targetEntryKeys.has(imageSetKey(entry.images)),
    );
    mergedPredictions.push(...predictions.entries);
    predictions.entries = mergedPredictions;

    const mergedStructured = existingStructured.entries.filter(
      (entry) => !targetEntryKeys.has(imageSetKey(entry.images)),
    );
    mergedStructured.push(...structuredPredictions.entries);
    structuredPredictions.entries = mergedStructured;

    const mergedCooklang = existingCooklang.entries.filter(
      (entry) => !targetEntryKeys.has(imageSetKey(entry.images)),
    );
    mergedCooklang.push(...cooklangPredictions.entries);
    cooklangPredictions.entries = mergedCooklang;

    const mergedFailures = existingFailures.entries.filter(
      (entry) => !targetEntryKeys.has(imageSetKey(entry.images)),
    );
    mergedFailures.push(...failures.entries);
    failures.entries = mergedFailures;
  }

  await Promise.all([
    writeJson(PREDICTIONS_PATH, predictions),
    writeJson(STRUCTURED_TEXT_PREDICTIONS_PATH, structuredPredictions),
    writeJson(COOKLANG_PREDICTIONS_PATH, cooklangPredictions),
    writeJson(PARSE_FAILURES_PATH, failures),
  ]);

  console.log(`Parsed ${predictions.entries.length} entries -> ${PREDICTIONS_PATH}`);
  console.log(
    `Structured extraction artifacts written to ${STRUCTURED_TEXT_PREDICTIONS_PATH}`,
  );
  console.log(`Cooklang artifacts written to ${COOKLANG_PREDICTIONS_PATH}`);
  console.log(`Failures written to ${PARSE_FAILURES_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
