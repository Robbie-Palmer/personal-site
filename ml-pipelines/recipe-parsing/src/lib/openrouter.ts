import { join } from "node:path";
import OpenAI from "openai";
import { z } from "zod";
import { IMAGES_DIR } from "./io.js";
import { imagePathToDataUrl } from "./images.js";
import { requiredEnv } from "./env.js";
import { parseRecipeJsonFromText } from "./recipe-output.js";
import { RecipeSchema, type Recipe } from "../schemas/ground-truth.js";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

const RECIPE_JSON_SCHEMA = z.toJSONSchema(RecipeSchema);

export async function inferRecipeFromImages(params: {
  imageFiles: string[];
  model: string;
  maxImageDimension: number;
  jpegQuality: number;
}): Promise<Recipe> {
  const apiKey = requiredEnv("OPENROUTER_API_KEY");
  const client = new OpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
  });

  const imageDataUrls = await Promise.all(
    params.imageFiles.map((imageFile) =>
      imagePathToDataUrl(
        join(IMAGES_DIR, imageFile),
        params.maxImageDimension,
        params.jpegQuality,
      ),
    ),
  );

  const content: Array<Record<string, unknown>> = [
    {
      type: "text",
      text:
        "Parse the recipe from these image(s). Return only JSON matching the schema. " +
        "Ingredient grouping matters, so preserve distinct groups (for example sauce/base) " +
        "when present. Ingredient identifiers should be normalized slugs such as 'olive-oil'.",
    },
    ...imageDataUrls.map((url) => ({
      type: "image_url",
      image_url: { url },
    })),
  ];

  const completion = await client.chat.completions.create({
    model: params.model,
    messages: [{ role: "user", content: content as any }],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "parsed_recipe",
        strict: true,
        schema: RECIPE_JSON_SCHEMA,
      },
    },
  } as any);

  return parseRecipeJsonFromText(completion.choices[0]?.message?.content);
}
