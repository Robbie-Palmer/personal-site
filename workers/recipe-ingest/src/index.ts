import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
  type WorkflowStepConfig,
} from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import { canonicalIngredients } from "recipe-parsing/canonical-ingredients-data";
import {
  buildCooklangDraftFromExtraction,
  deriveRecipeFromCooklang,
} from "recipe-parsing/cooklang";
import {
  applyDisambiguationChoices,
  applyLlmDecisionsToEntry,
  buildCategoryMap,
  collectUnresolved,
  extractRecipeContext,
} from "recipe-parsing/disambiguation";
import {
  buildOntologyIndex,
  canonicalizePredictionEntry,
} from "recipe-parsing/ingredient-canonicalization";
import {
  disambiguateIngredients,
  extractRecipeFromImages,
  normalizeExtractionToCooklang,
} from "recipe-parsing/openrouter";
import type { ExtractionRecipe } from "recipe-parsing/schemas/ground-truth";
import type { CooklangRecipe } from "recipe-parsing/schemas/stage-artifacts";
import { writeArtifact } from "./artifacts";
import { runLlmCall } from "./attempts";
import { withDb } from "./db";
import { buildFinalDraft } from "./draft";
import type { Env } from "./env";
import { listSourceImageKeys, loadImageDataUrls } from "./images";
import {
  markJobFailed,
  markJobRunning,
  markJobSucceeded,
  updateJobStage,
} from "./jobs";
import { stageParams, type StageParams } from "./params";

export type IngestParams = {
  jobId: string;
};

function llmStepConfig(params: StageParams): WorkflowStepConfig {
  return {
    retries: {
      limit: params.retryLimit,
      delay: 1_000,
      backoff: "exponential",
    },
    // Per-attempt ceiling: R2 reads + one provider call + attempt bookkeeping.
    timeout: params.requestTimeoutMs + 60_000,
  };
}

export class RecipeIngestWorkflow extends WorkflowEntrypoint<Env, IngestParams> {
  override async run(
    event: WorkflowEvent<IngestParams>,
    step: WorkflowStep,
  ): Promise<void> {
    const { jobId } = event.payload;
    const env = this.env;

    try {
      const sourceKeys = await step.do("start", async () => {
        const keys = await listSourceImageKeys(env, jobId);
        if (keys.length === 0) {
          throw new NonRetryableError(
            `No source images found for job ${jobId}`,
          );
        }
        await withDb(env, (db) =>
          markJobRunning(db, jobId, event.instanceId),
        );
        return keys;
      });

      const extractParams = stageParams(env, "extract");
      const extraction = await step.do(
        "extract",
        llmStepConfig(extractParams),
        async (): Promise<ExtractionRecipe> => {
          const imageDataUrls = await loadImageDataUrls(env, sourceKeys);
          return runLlmCall({
            env,
            jobId,
            stage: "extract",
            model: extractParams.model,
            call: () =>
              extractRecipeFromImages({
                apiKey: env.OPENROUTER_API_KEY,
                imageDataUrls,
                model: extractParams.model,
                requestTimeoutMs: extractParams.requestTimeoutMs,
              }),
          });
        },
      );

      await step.do("persist-extract", async () => {
        await withDb(env, async (db) => {
          await writeArtifact({
            env,
            db,
            jobId,
            stage: "extract",
            kind: "extraction",
            filename: "extraction.json",
            payload: extraction,
            model: extractParams.model,
          });
          await updateJobStage(
            db,
            jobId,
            "normalize",
            "Tidying the recipe into a draft",
          );
        });
      });

      const normalizeParams = stageParams(env, "normalize");
      let cooklang: CooklangRecipe;
      try {
        cooklang = await step.do(
          "normalize",
          llmStepConfig(normalizeParams),
          async (): Promise<CooklangRecipe> => {
            const llmCooklang = await runLlmCall({
              env,
              jobId,
              stage: "normalize",
              model: normalizeParams.model,
              call: () =>
                normalizeExtractionToCooklang({
                  apiKey: env.OPENROUTER_API_KEY,
                  extracted: extraction,
                  model: normalizeParams.model,
                  requestTimeoutMs: normalizeParams.requestTimeoutMs,
                }),
            });

            // Always re-derive from the body to ensure slug normalization is applied.
            const derived = deriveRecipeFromCooklang({
              ...llmCooklang,
              derived: undefined,
            });
            if (derived.derived) {
              return derived;
            }

            // LLM produced Cooklang but derivation failed — deterministic draft fallback.
            const draft = buildCooklangDraftFromExtraction(extraction);
            if (draft.derived) {
              return {
                ...derived,
                derived: draft.derived,
                diagnostics: [
                  ...derived.diagnostics,
                  "LLM cooklang derivation failed; using deterministic draft.",
                ],
              };
            }
            throw new NonRetryableError(derived.diagnostics.join(" | "));
          },
        );
      } catch (normalizeError) {
        // Normalization failed outright — fall back to the deterministic draft,
        // mirroring the evaluation pipeline's behaviour.
        cooklang = await step.do("normalize-fallback", async () => {
          const draft = buildCooklangDraftFromExtraction(extraction);
          if (!draft.derived) {
            throw new NonRetryableError(
              "Normalization failed and deterministic draft could not produce a recipe",
            );
          }
          return {
            ...draft,
            diagnostics: [
              ...draft.diagnostics,
              `Normalization LLM failed; using deterministic draft. (${
                normalizeError instanceof Error
                  ? normalizeError.message
                  : String(normalizeError)
              })`,
            ],
          };
        });
      }

      await step.do("persist-normalize", async () => {
        await withDb(env, async (db) => {
          await writeArtifact({
            env,
            db,
            jobId,
            stage: "normalize",
            kind: "cooklang",
            filename: "cooklang.json",
            payload: cooklang,
            model: normalizeParams.model,
          });
          await updateJobStage(
            db,
            jobId,
            "canonicalize",
            "Matching ingredients to the pantry",
          );
        });
      });

      const canonicalizeParams = stageParams(env, "canonicalize");
      const canonical = await step.do(
        "canonicalize",
        llmStepConfig(canonicalizeParams),
        async (ctx) => {
          const recipe = cooklang.derived;
          if (!recipe) {
            throw new NonRetryableError(
              "Normalized recipe missing derived output",
            );
          }

          const ontology = new Set(
            canonicalIngredients.ingredients.map((i) => i.slug),
          );
          const ontologyIndex = buildOntologyIndex(ontology);
          const { entry, decisions, cookwareDecisions } =
            canonicalizePredictionEntry(
              { images: sourceKeys, predicted: recipe },
              ontology,
              ontologyIndex,
            );

          const categoryMap = buildCategoryMap(canonicalIngredients.ingredients);
          const unresolved = collectUnresolved(decisions, categoryMap);
          if (unresolved.length > 0) {
            try {
              const choices = await runLlmCall({
                env,
                jobId,
                stage: "canonicalize",
                model: canonicalizeParams.model,
                call: () =>
                  disambiguateIngredients({
                    apiKey: env.OPENROUTER_API_KEY,
                    unresolvedItems: unresolved,
                    recipeContext: extractRecipeContext(entry, decisions),
                    model: canonicalizeParams.model,
                    requestTimeoutMs: canonicalizeParams.requestTimeoutMs,
                  }),
              });
              applyDisambiguationChoices(decisions, unresolved, choices);
            } catch (error) {
              // Rethrow retryable provider errors while step attempts remain;
              // otherwise disambiguation is best-effort — keep the
              // deterministic results.
              const attemptsRemain =
                ctx.attempt <= canonicalizeParams.retryLimit;
              if (attemptsRemain && !(error instanceof NonRetryableError)) {
                throw error;
              }
              console.warn(
                `LLM disambiguation failed for job ${jobId}: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              );
            }
          }

          const finalEntry = applyLlmDecisionsToEntry(entry, decisions);
          return { recipe: finalEntry.predicted, decisions, cookwareDecisions };
        },
      );

      await step.do("persist-canonicalize", async () => {
        await withDb(env, async (db) => {
          await writeArtifact({
            env,
            db,
            jobId,
            stage: "canonicalize",
            kind: "canonicalization-decisions",
            filename: "decisions.json",
            payload: {
              decisions: canonical.decisions,
              cookwareDecisions: canonical.cookwareDecisions,
            },
            model: canonicalizeParams.model,
          });
          await updateJobStage(db, jobId, "finalize", "Preparing your draft");
        });
      });

      await step.do("finalize", async () => {
        const draft = buildFinalDraft(
          sourceKeys,
          cooklang,
          canonical.recipe,
          canonical.cookwareDecisions,
        );
        await withDb(env, async (db) => {
          await writeArtifact({
            env,
            db,
            jobId,
            stage: "finalize",
            kind: "draft",
            filename: "draft.json",
            payload: draft,
            preview: draft,
          });
          await markJobSucceeded(db, jobId);
        });
      });
    } catch (error) {
      const errorType =
        error instanceof Error && error.name ? error.name : "IngestError";
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Recipe ingestion failed", {
        jobId,
        errorType,
        errorMessage,
      });
      await step.do("mark-failed", async () => {
        await withDb(env, (db) =>
          markJobFailed(db, jobId, errorType, errorMessage),
        );
      });
      throw error;
    }
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({ status: "ok", service: "recipe-ingest" });
    }
    return new Response("Not found", { status: 404 });
  },
};
