import { resolveIngredientSlug } from "recipe-domain";
import { ingredients } from "../../../ui/content/recipes/ingredients";

export type DietGroupKey =
  | "alcohol"
  | "chilli"
  | "dairy"
  | "egg"
  | "fish"
  | "garlic"
  | "gluten"
  | "legumes"
  | "meat"
  | "nuts"
  | "onion"
  | "peanut"
  | "poultry"
  | "shellfish"
  | "soy"
  | "wheat";

const WHEAT_AND_GLUTEN_INGREDIENTS = [
  "macaroni",
  "penne pasta",
  "large pasta shells",
  "pasta",
  "tortilla wrap",
  "farfalle",
  "plain flour",
  "bread flour",
  "semolina",
  "bread",
  "noodles",
  "bap",
  "garlic bread",
  "self-raising flour",
  "flour",
  "naan",
  "baps",
  "orzo",
  "pita",
  "spaghetti",
] as const;

const EXPLICIT_GROUP_MEMBERS: Partial<
  Record<DietGroupKey, readonly string[]>
> = {
  alcohol: ["white wine"],
  chilli: [
    "hot chilli powder",
    "cayenne pepper",
    "chilli",
    "chilli flakes",
    "red chilli powder",
    "chilli powder",
    "chili powder",
    "sweet chilli sauce",
    "chilli mayo",
    "sriracha",
    "red curry paste",
  ],
  egg: ["eggs", "mayonnaise", "chilli mayo"],
  fish: [],
  garlic: [
    "garlic",
    "garlic puree",
    "garlic granules",
    "garlic powder",
    "garlic bread",
  ],
  gluten: WHEAT_AND_GLUTEN_INGREDIENTS,
  meat: ["chorizo", "bacon", "pork sausage"],
  nuts: ["cashew nuts", "cashews", "ground almonds", "almond milk"],
  onion: [
    "white onion",
    "red onion",
    "onion",
    "spring onion",
    "shallots",
    "onion salt",
    "onion powder",
  ],
  peanut: ["peanut butter", "crunchy peanut butter"],
  poultry: [
    "chicken breast",
    "turkey mince",
    "chicken thigh",
    "chicken stock",
    "chicken stock pot",
  ],
  shellfish: ["prawn crackers"],
  soy: ["soy sauce", "dark soy sauce", "light soy sauce"],
  wheat: WHEAT_AND_GLUTEN_INGREDIENTS,
};

export const dietCatalogIngredients = ingredients.map((ingredient) => ({
  slug: resolveIngredientSlug(ingredient),
  name: ingredient.name,
  category: ingredient.category,
}));

const ingredientByName = new Map<
  string,
  (typeof dietCatalogIngredients)[number]
>(
  dietCatalogIngredients.map((ingredient) => [ingredient.name, ingredient]),
);

function slugForName(context: string, name: string) {
  const ingredient = ingredientByName.get(name);
  if (!ingredient) {
    throw new Error(`Unknown ${context} ingredient: ${name}`);
  }
  return ingredient.slug;
}

function slugsForNames(context: string, names: readonly string[]) {
  return names.map((name) => {
    return slugForName(context, name);
  });
}

const categoryGroups: Partial<
  Record<DietGroupKey, (typeof dietCatalogIngredients)[number]["category"]>
> = {
  dairy: "dairy",
  legumes: "legume",
};

export const dietGroupMembers = (
  Object.keys({
    ...EXPLICIT_GROUP_MEMBERS,
    ...categoryGroups,
  }) as DietGroupKey[]
).flatMap((groupKey) => {
  const explicitSlugs = slugsForNames(
    `diet group "${groupKey}"`,
    EXPLICIT_GROUP_MEMBERS[groupKey] ?? [],
  );
  const category = categoryGroups[groupKey];
  const categorySlugs = category
    ? dietCatalogIngredients
        .filter((ingredient) => ingredient.category === category)
        .map((ingredient) => ingredient.slug)
    : [];

  return Array.from(new Set([...explicitSlugs, ...categorySlugs])).map(
    (ingredientSlug) => ({ groupKey, ingredientSlug }),
  );
});

export const dietPresetIngredientExclusions = [
  {
    presetKey: "vegan",
    ingredientSlug: slugForName('diet preset "vegan"', "honey"),
  },
] as const;
