import { encodeXML, escapeText } from "entities";
import { z } from "zod";
import { pluralizeIngredientTerm } from "./pluralization";
import {
  type RecipeContent,
  RecipeContentSchema,
  type RecipeIngredient,
} from "./recipe";
import { UNIT_LABELS } from "./unit";

export const SavedRecipePayloadSchema = z.object({
  version: z.literal(1),
  source: z.string().min(1),
  recipe: RecipeContentSchema,
});

export type SavedRecipePayload = z.infer<typeof SavedRecipePayloadSchema>;

type ExportIngredient = RecipeIngredient & {
  name?: string;
  pluralName?: string;
};

type ExportRecipe = Omit<RecipeContent, "ingredientGroups"> & {
  ingredientGroups: {
    name?: string;
    items: ExportIngredient[];
  }[];
};

const FRACTIONS: Array<[number, string]> = [
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [1 / 2, "½"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
];

function formatAmount(amount: number): string {
  const whole = Math.floor(amount);
  const fraction = amount - whole;
  if (fraction < 0.01) return String(whole);
  for (const [value, symbol] of FRACTIONS) {
    if (Math.abs(fraction - value) < 0.02) {
      return whole > 0 ? `${whole}${symbol}` : symbol;
    }
  }
  return amount.toFixed(1);
}

function ingredientName(item: ExportIngredient): string {
  return item.name ?? item.ingredient.replaceAll("-", " ");
}

export function formatRecipeIngredientText(
  item: ExportIngredient,
  options?: { includeNote?: boolean },
): string {
  const parts: string[] = [];
  if (item.amount != null) parts.push(formatAmount(item.amount));

  const label = item.unit === undefined ? undefined : UNIT_LABELS[item.unit];
  if (label && item.unit !== "piece") {
    const unit =
      item.amount != null && item.amount > 1 ? label.plural : label.singular;
    if (label.noSpace && parts.length > 0) {
      parts[parts.length - 1] += unit;
    } else {
      parts.push(unit);
    }
  }

  const name = ingredientName(item);
  const isPlural = item.amount != null && item.amount !== 1;
  parts.push(
    isPlural
      ? item.unit === "piece"
        ? (item.pluralName ?? pluralizeIngredientTerm(name))
        : (item.pluralName ?? name)
      : name,
  );
  if (item.preparation) parts.push(`(${item.preparation})`);
  if (options?.includeNote && item.note) parts.push(`– ${item.note}`);
  return parts.join(" ").trim();
}

export function formatRecipeMarkdown(recipe: ExportRecipe): string {
  const facts = [
    `- Servings: ${recipe.servings}`,
    ...(recipe.prepTime == null ? [] : [`- Prep time: ${recipe.prepTime} min`]),
    ...(recipe.cookTime == null ? [] : [`- Cook time: ${recipe.cookTime} min`]),
    ...(recipe.cuisine.length === 0
      ? []
      : [`- Cuisine: ${recipe.cuisine.join(", ")}`]),
  ];
  const ingredients = recipe.ingredientGroups.flatMap((group) => [
    ...(group.name ? [`### ${group.name}`, ""] : []),
    ...group.items.map(
      (item) =>
        `- ${formatRecipeIngredientText(item, { includeNote: true })}`,
    ),
    "",
  ]);
  const cookware =
    recipe.cookware.length === 0
      ? []
      : [
          "## Cookware",
          "",
          ...recipe.cookware.map((item) => `- ${item}`),
          "",
        ];
  return [
    `# ${recipe.title}`,
    "",
    recipe.description,
    "",
    ...facts,
    "",
    "## Ingredients",
    "",
    ...ingredients,
    ...cookware,
    "## Instructions",
    "",
    ...recipe.instructions.map(
      (instruction, index) => `${index + 1}. ${instruction}`,
    ),
    "",
  ].join("\n");
}

export function formatRecipeCooklang(
  recipe: ExportRecipe,
  source = recipe.cookBody,
): string {
  const ingredientAnnotations = Object.fromEntries(
    recipe.ingredientGroups
      .flatMap((group) => group.items)
      .filter((item) => item.preparation || item.note)
      .map((item) => [
        item.ingredient,
        {
          ...(item.preparation ? { preparation: item.preparation } : {}),
          ...(item.note ? { note: item.note } : {}),
        },
      ]),
  );
  const frontmatter = [
    "---",
    `title: ${JSON.stringify(recipe.title)}`,
    `description: ${JSON.stringify(recipe.description)}`,
    `date: ${JSON.stringify(recipe.date)}`,
    `cuisine: ${JSON.stringify(recipe.cuisine)}`,
    `servings: ${recipe.servings}`,
    ...(recipe.prepTime == null ? [] : [`prepTime: ${recipe.prepTime}`]),
    ...(recipe.cookTime == null ? [] : [`cookTime: ${recipe.cookTime}`]),
    `tags: ${JSON.stringify(recipe.tags)}`,
    ...(recipe.image ? [`image: ${JSON.stringify(recipe.image)}`] : []),
    ...(recipe.imageAlt ? [`imageAlt: ${JSON.stringify(recipe.imageAlt)}`] : []),
    ...(recipe.canonical
      ? [`canonical: ${JSON.stringify(recipe.canonical)}`]
      : []),
    ...(Object.keys(ingredientAnnotations).length === 0
      ? []
      : [`ingredientAnnotations: ${JSON.stringify(ingredientAnnotations)}`]),
    "---",
  ];
  return `${frontmatter.join("\n")}\n${source.trim()}\n`;
}

export const escapeHtmlText = escapeText;
export const escapeHtmlAttribute = encodeXML;
