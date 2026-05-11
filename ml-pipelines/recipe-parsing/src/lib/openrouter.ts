import { join } from "node:path";
import OpenAI from "openai";
import { z } from "zod";
import { IMAGES_DIR } from "./io.js";
import { imagePathToDataUrl } from "./images.js";
import { requiredEnv } from "./env.js";
import { parseRecipeJsonFromText } from "./recipe-output.js";
import {
  ExtractionRecipeSchema,
  RecipeSchema,
  type ExtractionRecipe,
  type Recipe,
} from "../schemas/ground-truth.js";
import {
  CooklangRecipeSchema,
  StructuredTextRecipeSchema,
  type CooklangRecipe,
  type StructuredTextRecipe,
} from "../schemas/stage-artifacts.js";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

const RECIPE_JSON_SCHEMA = z.toJSONSchema(RecipeSchema);
const EXTRACTION_RECIPE_JSON_SCHEMA = z.toJSONSchema(ExtractionRecipeSchema);
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

export async function extractRecipeFromImages(params: {
  imageFiles: string[];
  model: string;
  requestTimeoutMs: number;
  maxImageDimension: number;
  jpegQuality: number;
}): Promise<ExtractionRecipe> {
  return runImagePrompt({
    ...params,
    instruction:
      "You are an OCR system. Extract the recipe from these image(s) into structured JSON.\n" +
      "Rules:\n" +
      "- Output ONLY what is explicitly visible in the image. Do NOT infer or assume anything.\n" +
      "- Do NOT fix typos or misspellings. Transcribe all text exactly as written.\n" +
      "- Do NOT infer cuisine, servings, prep time, cook time, or description unless explicitly shown.\n" +
      "- Preserve instruction steps exactly as written. Do not split or merge steps.\n" +
      "- Strip leading step numbers (e.g. '1.', '2)') from instructions — the JSON array provides ordering.\n" +
      "- Preserve ingredient names as they appear in the image.\n" +
      "- Preserve distinct ingredient groups (e.g. sauce/base) when present.\n" +
      "- Capture explicitly listed equipment in the equipment array using the wording shown in the image.\n" +
      "- Omit optional fields entirely if the image does not explicitly show them.",
    schemaName: "extraction_recipe",
    schemaJson: EXTRACTION_RECIPE_JSON_SCHEMA,
    schema: ExtractionRecipeSchema,
  });
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

export async function normalizeExtractionToCooklang(params: {
  extracted: ExtractionRecipe;
  model: string;
  requestTimeoutMs: number;
}): Promise<CooklangRecipe> {
  const apiKey = requiredEnv("OPENROUTER_API_KEY");
  const client = getOrCreateOpenRouterClient(apiKey);

  const prompt =
    "Normalize the following raw recipe extraction into Cooklang format with frontmatter.\n" +
    "This extraction was produced by OCR and may contain typos, inconsistent formatting, " +
    "and missing metadata.\n\n" +
    "Your job:\n" +
    "- Fix any typos or misspellings in ingredient names and instructions.\n" +
    "- Normalize units (e.g. 'TBSP' → 'tbsp', 'tablespoon' → 'tbsp'). " +
    "Counting words like clove, fillet, slice, rasher, bunch, sprig, pinch are units, not part of the ingredient name. " +
    "Write @garlic{2%clove} not @garlic clove{2}, @bacon{4%rasher} not @bacon rasher{4}.\n" +
    "- Normalize a bare ingredient name of 'oil' to olive oil unless the recipe clearly specifies a different oil.\n" +
    "- Clean up instruction formatting: consistent casing, punctuation, and sentence structure.\n" +
    "- If multiple actions are crammed into one step, split them into separate steps.\n" +
    "- Each instruction step MUST be separated by a blank line (two newlines: \\n\\n) in the body. " +
    "Consecutive lines without a blank line between them are treated as a single step by the Cooklang parser.\n" +
    "- In the body, use Cooklang annotations: @ingredient name{amount%unit}, #cookware{}, and ~{duration%unit} for timers.\n" +
    "  Timers MUST use the format ~{duration%unit} with the number and unit inside braces separated by %. " +
    "Write ~{5%minutes}, ~{1%hour}, ~{30%seconds}. " +
    "Never put the number before the braces — ~5{minutes} is WRONG because the parser treats '5' as a name, not a duration.\n" +
    "  Multi-word ingredients MUST use spaces (not hyphens) and MUST include braces: " +
    "@olive oil{1%tbsp}, @chicken breast{500%g}, @bell pepper{}. " +
    "Never write @olive-oil or @chicken-breast — the parser treats hyphens as the end of the name.\n" +
    "  Ingredient amounts are additive across the recipe. Only include an amount on an ingredient mention when that step adds or uses a specific portion of the ingredient. " +
    "If a later step merely refers to an ingredient already added or prepared earlier, mention it without repeating the full amount. " +
    "Repeat amounts only for genuine split additions, and make those partial amounts sum to the total recipe quantity.\n" +
    "  Do not invent missing ingredient quantities or units. If the recipe mentions an ingredient without an explicit amount, leave the quantity blank rather than guessing values like 1 tbsp.\n" +
    "  The same rule applies to multi-word cookware — use spaces and braces: #baking tray{}, #frying pan{}. " +
    "Never write #baking-tray or #frying-pan.\n" +
    "- Equipment names in #cookware{} must be generic base nouns without size or material adjectives. " +
    "Write 'in a large #saucepan{}' not '#large saucepan{}', 'on a non-stick #frying pan{}' not '#non-stick frying pan{}'. " +
    "Keep adjectives in the surrounding prose, not inside the annotation.\n" +
    "- In frontmatter ingredientAnnotations, use lowercase-hyphenated slugs as keys (e.g. 'olive-oil', 'chicken-breast').\n" +
    "- Infer a short description summarizing the dish.\n" +
    "- Cuisine must be a JSON array of strings, e.g. [\"British\", \"Chinese\"]. Do not fuse cuisines with hyphens. For example, write [\"Italian\", \"American\"] not [\"Italian-American\"].\n" +
    "- Infer cuisine when there is strong evidence from ingredients and techniques.\n" +
    "- Infer servings from context if not explicitly stated (default to a reasonable number).\n" +
    "- Leave prepTime blank if it is not obvious from the recipe. Do not guess prep time from the general complexity of the dish.\n" +
    "- Include cookTime only when there is strong evidence.\n" +
    "- Return JSON only.\n\n" +
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
          schema: COOKLANG_JSON_SCHEMA as Record<string, unknown>,
        },
      },
    },
    { timeout: params.requestTimeoutMs },
  );

  return parseSchemaJsonFromText(completion.choices[0]?.message?.content, CooklangRecipeSchema);
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
    "Timers MUST use ~{duration%unit} with the number inside braces: ~{5%minutes}, ~{1%hour}. " +
    "Never write ~5{minutes} — the parser treats the number before braces as a name, not a duration. " +
    "In the body, multi-word ingredients MUST use spaces (not hyphens) and MUST include braces: " +
    "@olive oil{1%tbsp}, @chicken breast{500%g}, @bell pepper{}. " +
    "Never write @olive-oil or @chicken-breast — the parser treats hyphens as the end of the name. " +
    "Normalize a bare ingredient name of 'oil' to olive oil unless the recipe clearly specifies a different oil. " +
    "Ingredient amounts are additive across the recipe. Only include an amount on an ingredient mention when that step adds or uses a specific portion of the ingredient. " +
    "If a later step merely refers to an ingredient already added or prepared earlier, mention it without repeating the full amount. " +
    "Repeat amounts only for genuine split additions, and make those partial amounts sum to the total recipe quantity. " +
    "Do not invent missing ingredient quantities or units. If the recipe mentions an ingredient without an explicit amount, leave the quantity blank rather than guessing values like 1 tbsp. " +
    "Counting words like clove, fillet, slice, rasher, bunch, sprig, pinch are units, not part of the ingredient name: " +
    "@garlic{2%clove} not @garlic clove{2}, @bacon{4%rasher} not @bacon rasher{4}. " +
    "The same applies to cookware: #baking tray{}, #frying pan{} (never #baking-tray). " +
    "Equipment names in #cookware{} must be generic base nouns — no size or material adjectives. " +
    "Write 'in a large #saucepan{}' not '#large saucepan{}'. Keep adjectives in the prose. " +
    "Each instruction step MUST be separated by a blank line (\\n\\n) in the body — consecutive lines without a blank line are a single step. " +
    "In frontmatter ingredientAnnotations, use lowercase-hyphenated slugs as keys (e.g. 'olive-oil'). " +
    "Cuisine must be a JSON array of strings, e.g. [\"British\", \"Chinese\"]. Do not fuse cuisines with hyphens. For example, write [\"Italian\", \"American\"] not [\"Italian-American\"]. " +
    "Infer missing cuisine only when there is strong evidence. " +
    "Leave prepTime blank if it is not obvious from the recipe, and include cookTime only when there is strong evidence. " +
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

export interface UnresolvedItem {
  slug: string;
  candidates: { slug: string; category: string }[];
}

export interface RecipeContext {
  title: string;
  cuisine: string[];
  otherIngredients: string[];
}

export interface DisambiguationChoice {
  slug: string;
  canonicalSlug: string;
  confidence: "high" | "medium" | "low";
}

const DisambiguationResponseSchema = z.object({
  choices: z.array(
    z.object({
      slug: z.string().min(1),
      canonicalSlug: z.string().min(1),
      confidence: z.enum(["high", "medium", "low"]),
    }),
  ),
});

const DISAMBIGUATION_JSON_SCHEMA = z.toJSONSchema(DisambiguationResponseSchema);

export async function disambiguateIngredients(params: {
  unresolvedItems: UnresolvedItem[];
  recipeContext: RecipeContext;
  model: string;
  requestTimeoutMs: number;
}): Promise<DisambiguationChoice[]> {
  const apiKey = requiredEnv("OPENROUTER_API_KEY");
  const client = getOrCreateOpenRouterClient(apiKey);

  const itemLines = params.unresolvedItems.map((item) => {
    const options = item.candidates
      .map((c) => `${c.slug} (${c.category})`)
      .join(", ");
    return `- "${item.slug}" → candidates: [${options}]`;
  });

  const prompt =
    "You are a recipe ingredient classifier. Given a recipe's context and a list of " +
    "ambiguous ingredient names, pick the best canonical match from the provided candidates.\n\n" +
    "Recipe context:\n" +
    `- Title: ${params.recipeContext.title}\n` +
    `- Cuisine: ${params.recipeContext.cuisine.length > 0 ? params.recipeContext.cuisine.join(", ") : "unknown"}\n` +
    `- Other ingredients: ${params.recipeContext.otherIngredients.join(", ") || "none"}\n\n` +
    "Unresolved ingredients:\n" +
    itemLines.join("\n") +
    "\n\n" +
    "For each unresolved ingredient, return your best match from the candidate list. " +
    "Only pick from the provided candidates. " +
    "Include a confidence level: 'high' if the context makes it obvious, " +
    "'medium' if it's a reasonable guess, 'low' if uncertain.\n" +
    "Return JSON only.";

  const completion = await client.chat.completions.create(
    {
      model: params.model,
      messages: [{ role: "user", content: prompt }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "disambiguation_result",
          strict: true,
          schema: DISAMBIGUATION_JSON_SCHEMA as Record<string, unknown>,
        },
      },
    },
    { timeout: params.requestTimeoutMs },
  );

  const result = parseSchemaJsonFromText(
    completion.choices[0]?.message?.content,
    DisambiguationResponseSchema,
  );
  return result.choices;
}
