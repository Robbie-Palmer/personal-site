import { join } from "node:path";
import OpenAI from "openai";
import { z } from "zod";
import { IMAGES_DIR } from "./io.js";
import { imagePathToDataUrl } from "./images.js";
import { requiredEnv } from "./env.js";
import { parseRecipeJsonFromText } from "./recipe-output.js";
import { RecipeSchema, type Recipe } from "../schemas/ground-truth.js";
import {
  CooklangRecipeSchema,
  StructuredTextRecipeSchema,
  type CooklangRecipe,
  type StructuredTextRecipe,
} from "../schemas/stage-artifacts.js";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

const RECIPE_JSON_SCHEMA = z.toJSONSchema(RecipeSchema);
const STRUCTURED_TEXT_JSON_SCHEMA = z.toJSONSchema(StructuredTextRecipeSchema);
const COOKLANG_JSON_SCHEMA = z.toJSONSchema(CooklangRecipeSchema);
const openRouterClients = new Map<string, OpenAI>();

function getOrCreateOpenRouterClient(apiKey: string): OpenAI {
  const existing = openRouterClients.get(apiKey);
  if (existing) return existing;

  const client = new OpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
  });
  openRouterClients.set(apiKey, client);
  return client;
}

export async function parseRecipeFromImages(params: {
  imageFiles: string[];
  model: string;
  requestTimeoutMs: number;
  maxImageDimension: number;
  jpegQuality: number;
}): Promise<Recipe> {
  const apiKey = requiredEnv("OPENROUTER_API_KEY");
  const client = getOrCreateOpenRouterClient(apiKey);

  const imageDataUrls = await Promise.all(
    params.imageFiles.map((imageFile) =>
      imagePathToDataUrl(
        join(IMAGES_DIR, imageFile),
        params.maxImageDimension,
        params.jpegQuality,
      ),
    ),
  );

  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    {
      type: "text",
      text:
        "Parse the recipe from these image(s). Return only JSON matching the schema. " +
        "Ingredient grouping matters, so preserve distinct groups (for example sauce/base) " +
        "when present. Ingredient identifiers should be normalized slugs such as 'olive-oil'.",
    },
    ...imageDataUrls.map(
      (url): OpenAI.Chat.Completions.ChatCompletionContentPartImage => ({
        type: "image_url",
        image_url: { url },
      }),
    ),
  ];

  const completion = await client.chat.completions.create(
    {
      model: params.model,
      messages: [{ role: "user", content }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "parsed_recipe",
          strict: true,
          schema: RECIPE_JSON_SCHEMA,
        },
      },
    },
    {
      timeout: params.requestTimeoutMs,
    },
  );

  return parseRecipeJsonFromText(completion.choices[0]?.message?.content);
}

function parseSchemaJsonFromText<T>(raw: string | null | undefined, schema: z.ZodType<T>): T {
  if (!raw) {
    throw new Error("Model returned empty content");
  }
  const trimmed = raw.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return schema.parse(JSON.parse(withoutFence));
}

async function runImagePrompt<T>(params: {
  imageFiles: string[];
  model: string;
  requestTimeoutMs: number;
  maxImageDimension: number;
  jpegQuality: number;
  instruction: string;
  schemaName: string;
  schemaJson: unknown;
  schema: z.ZodType<T>;
}): Promise<T> {
  const apiKey = requiredEnv("OPENROUTER_API_KEY");
  const client = getOrCreateOpenRouterClient(apiKey);

  const imageDataUrls = await Promise.all(
    params.imageFiles.map((imageFile) =>
      imagePathToDataUrl(
        join(IMAGES_DIR, imageFile),
        params.maxImageDimension,
        params.jpegQuality,
      ),
    ),
  );

  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: "text", text: params.instruction },
    ...imageDataUrls.map(
      (url): OpenAI.Chat.Completions.ChatCompletionContentPartImage => ({
        type: "image_url",
        image_url: { url },
      }),
    ),
  ];

  const completion = await client.chat.completions.create(
    {
      model: params.model,
      messages: [{ role: "user", content }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: params.schemaName,
          strict: true,
          schema: params.schemaJson as Record<string, unknown>,
        },
      },
    },
    { timeout: params.requestTimeoutMs },
  );

  return parseSchemaJsonFromText(completion.choices[0]?.message?.content, params.schema);
}

export async function extractStructuredTextFromImages(params: {
  imageFiles: string[];
  model: string;
  requestTimeoutMs: number;
  maxImageDimension: number;
  jpegQuality: number;
}): Promise<StructuredTextRecipe> {
  return runImagePrompt({
    ...params,
    instruction:
      "Read these recipe image(s) and return structured extraction JSON only. " +
      "Preserve ingredient lines and instruction lines as written where possible. " +
      "Capture raw scalar text such as servings and times without forcing normalization.",
    schemaName: "structured_recipe_extraction",
    schemaJson: STRUCTURED_TEXT_JSON_SCHEMA,
    schema: StructuredTextRecipeSchema,
  });
}

export async function generateCooklangFromStructuredText(params: {
  extracted: StructuredTextRecipe;
  model: string;
  requestTimeoutMs: number;
}): Promise<CooklangRecipe> {
  const apiKey = requiredEnv("OPENROUTER_API_KEY");
  const client = getOrCreateOpenRouterClient(apiKey);

  const prompt =
    "Convert the provided structured recipe extraction into Cooklang plus frontmatter. " +
    "Use inline ingredient, cookware, and timer annotations when they are supported by the evidence. " +
    "Infer missing cuisine and total times only when there is strong evidence. " +
    "Return JSON only.\n\n" +
    JSON.stringify(params.extracted, null, 2);

  const completion = await client.chat.completions.create(
    {
      model: params.model,
      messages: [{ role: "user", content: prompt }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "cooklang_recipe",
          strict: true,
          schema: COOKLANG_JSON_SCHEMA,
        },
      },
    },
    { timeout: params.requestTimeoutMs },
  );

  return parseSchemaJsonFromText(completion.choices[0]?.message?.content, CooklangRecipeSchema);
}
