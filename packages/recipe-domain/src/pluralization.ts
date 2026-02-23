import pluralize from "pluralize";

const UNCOUNTABLE_INGREDIENTS = [
  "butter",
  "water",
  "milk",
  "rice",
  "pasta",
  "flour",
  "sugar",
  "salt",
  "pepper",
  "garlic",
  "spinach",
  "cheese",
  "msg",
];

let hasInitializedUncountables = false;

function initUncountables(): void {
  if (hasInitializedUncountables) return;
  for (const term of UNCOUNTABLE_INGREDIENTS) {
    pluralize.addUncountableRule(term);
  }
  hasInitializedUncountables = true;
}

export function pluralizeIngredientTerm(term: string): string {
  initUncountables();
  return pluralize.plural(term);
}

export function singularizeIngredientTerm(term: string): string {
  initUncountables();
  return pluralize.singular(term);
}
