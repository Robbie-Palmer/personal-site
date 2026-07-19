import { formatIngredientStaticText } from "@/lib/domain/recipe/ingredientText";
import type {
  RecipeCardView,
  RecipeDetailView,
} from "@/lib/domain/recipe/recipeViews";

export type SchemaOrgPerson = {
  "@type": "Person";
  name: string;
};

export type SchemaOrgHowToStep = {
  "@type": "HowToStep";
  text: string;
};

export type SchemaOrgCreativeWorkRef = {
  "@type": "Recipe";
  url: string;
};

export type SchemaOrgRecipe = {
  "@context": "https://schema.org";
  "@type": "Recipe";
  name: string;
  url: string;
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
  isBasedOn?: SchemaOrgCreativeWorkRef;
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
  recipeUrl: string,
): SchemaOrgRecipe {
  if (!recipe.image) {
    warnMissing(recipe.slug, "image");
  }
  if (!recipe.description) {
    warnMissing(recipe.slug, "description");
  }

  const imageUrl = recipe.image ? buildSchemaImageUrl(recipe.image) : undefined;

  const recipeIngredient = recipe.ingredientGroups.flatMap((group) =>
    group.items.map((item) => formatIngredientStaticText(item)),
  );

  const recipeInstructions: SchemaOrgHowToStep[] = recipe.instructions.map(
    (text) => ({ "@type": "HowToStep", text }),
  );

  const jsonLd: SchemaOrgRecipe = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: recipe.title,
    url: recipeUrl,
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
  if (recipe.canonical) {
    jsonLd.isBasedOn = { "@type": "Recipe", url: recipe.canonical };
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
