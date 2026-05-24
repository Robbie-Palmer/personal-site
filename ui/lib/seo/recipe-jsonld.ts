import type {
  RecipeCardView,
  RecipeDetailView,
  RecipeIngredientView,
} from "@/lib/domain/recipe/recipeViews";
import { UNIT_LABELS } from "@/lib/domain/recipe/unit";

export type SchemaOrgPerson = {
  "@type": "Person";
  name: string;
};

export type SchemaOrgHowToStep = {
  "@type": "HowToStep";
  text: string;
};

export type SchemaOrgRecipe = {
  "@context": "https://schema.org";
  "@type": "Recipe";
  name: string;
  description?: string;
  image?: string[];
  author: SchemaOrgPerson;
  datePublished: string;
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  recipeYield: string;
  recipeCuisine?: string | string[];
  keywords?: string;
  recipeIngredient: string[];
  recipeInstructions: SchemaOrgHowToStep[];
};

export type SchemaOrgListItem = {
  "@type": "ListItem";
  position: number;
  url: string;
  name: string;
};

export type SchemaOrgItemList = {
  "@context": "https://schema.org";
  "@type": "ItemList";
  itemListElement: SchemaOrgListItem[];
};

/** Convert integer minutes → ISO 8601 duration, e.g. 75 → "PT1H15M". */
export function minutesToIsoDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `PT${m}M`;
  if (m === 0) return `PT${h}H`;
  return `PT${h}H${m}M`;
}

const FRACTION_MAP: Array<[number, string]> = [
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [1 / 2, "½"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
];

function formatAmount(amount: number): string {
  const whole = Math.floor(amount);
  const frac = amount - whole;
  if (frac < 0.01) return String(whole);
  for (const [val, sym] of FRACTION_MAP) {
    if (Math.abs(frac - val) < 0.02) {
      return whole > 0 ? `${whole}${sym}` : sym;
    }
  }
  return amount.toFixed(1);
}

function formatRecipeIngredient(item: RecipeIngredientView): string {
  const parts: string[] = [];

  if (item.amount != null) {
    parts.push(formatAmount(item.amount));
  }

  if (item.unit) {
    const label = UNIT_LABELS[item.unit];
    const isPlural = item.amount != null && item.amount > 1;
    const unitStr = isPlural ? label.plural : label.singular;
    if (label.noSpace && parts.length > 0) {
      parts[parts.length - 1] += unitStr;
    } else {
      parts.push(unitStr);
    }
  }

  const name =
    item.amount != null && item.amount !== 1 && item.pluralName
      ? item.pluralName
      : item.name;
  parts.push(name);

  if (item.preparation) {
    parts.push(`(${item.preparation})`);
  }

  return parts.join(" ").trim();
}

// Returns undefined when the env var is absent (e.g. local dev without credentials).
function buildSchemaImageUrl(imageId: string): string | undefined {
  const accountHash = process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH;
  if (!accountHash) return undefined;
  return `https://imagedelivery.net/${accountHash}/${imageId}/w=1200,f=jpeg,q=85`;
}

function warnMissing(slug: string, field: string): void {
  console.warn(
    `[schema.org] Recipe "${slug}" is missing "${field}" — required for Google rich results.`,
  );
}

export function buildRecipeJsonLd(
  recipe: RecipeDetailView,
  authorName: string,
): SchemaOrgRecipe {
  if (!recipe.image) {
    warnMissing(recipe.slug, "image");
  }
  if (!recipe.description) {
    warnMissing(recipe.slug, "description");
  }

  const imageUrl = recipe.image ? buildSchemaImageUrl(recipe.image) : undefined;

  const recipeIngredient = recipe.ingredientGroups.flatMap((group) =>
    group.items.map(formatRecipeIngredient),
  );

  const recipeInstructions: SchemaOrgHowToStep[] = recipe.instructions.map(
    (text) => ({ "@type": "HowToStep", text }),
  );

  const jsonLd: SchemaOrgRecipe = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: recipe.title,
    author: { "@type": "Person", name: authorName },
    datePublished: recipe.date,
    recipeYield: `${recipe.servings} serving${recipe.servings !== 1 ? "s" : ""}`,
    recipeIngredient,
    recipeInstructions,
  };

  if (recipe.description) jsonLd.description = recipe.description;
  if (imageUrl) jsonLd.image = [imageUrl];
  if (recipe.prepTime != null)
    jsonLd.prepTime = minutesToIsoDuration(recipe.prepTime);
  if (recipe.cookTime != null)
    jsonLd.cookTime = minutesToIsoDuration(recipe.cookTime);
  if (recipe.totalTime != null)
    jsonLd.totalTime = minutesToIsoDuration(recipe.totalTime);
  if (recipe.cuisine.length > 0) {
    jsonLd.recipeCuisine =
      recipe.cuisine.length === 1 ? recipe.cuisine[0] : recipe.cuisine;
  }
  const keywordParts = [...recipe.tags, ...recipe.cuisine];
  if (keywordParts.length > 0) {
    jsonLd.keywords = keywordParts.join(", ");
  }

  return jsonLd;
}

export function buildRecipeListJsonLd(
  recipes: RecipeCardView[],
  siteUrl: string,
): SchemaOrgItemList {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: recipes.map((recipe, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${siteUrl}/recipes/${recipe.slug}`,
      name: recipe.title,
    })),
  };
}
