import { describe, expect, it } from "vitest";
import { parseSchemaOrgRecipeHtml } from "../../src/lib/schema-org.js";

describe("parseSchemaOrgRecipeHtml", () => {
  it("imports a Recipe from a JSON-LD graph into Cooklang source", () => {
    const html = `<!doctype html><script type="application/ld+json">
      {"@context":"https://schema.org","@graph":[
        {"@type":"WebPage","name":"Dinner"},
        {"@type":["Thing","Recipe"],"name":"Tomato &amp; Basil Pasta",
         "description":"A <b>quick</b> supper.","recipeCuisine":["Italian"],
         "recipeYield":"Serves 4","prepTime":"PT10M","cookTime":"PT1H5M",
         "recipeIngredient":["200 g dried pasta","2 tbsp olive oil","400g chopped tomatoes"],
         "recipeInstructions":[
           {"@type":"HowToSection","name":"Cook","itemListElement":[
             {"@type":"HowToStep","text":"Boil the pasta."},
             {"@type":"HowToStep","text":"Stir in the tomatoes &amp; serve."}
           ]}
         ]}
      ]}</script>`;

    expect(parseSchemaOrgRecipeHtml(html)).toEqual({
      title: "Tomato & Basil Pasta",
      description: "A quick supper.",
      cuisine: "Italian",
      servings: 4,
      prepTime: 10,
      cookTime: 65,
      source:
        "@dried pasta{200%g}\n@olive oil{2%tbsp}\n@chopped tomatoes{400%g}\n\nBoil the pasta.\n\nStir in the tomatoes & serve.",
    });
  });

  it("supports a top-level array and plain instruction strings", () => {
    const html = `<script TYPE='application/ld+json'>[
      {"@type":"BreadcrumbList"},
      {"@type":"https://schema.org/Recipe","name":"Toast","recipeIngredient":["2 slices bread"],
       "recipeInstructions":["Toast the bread."],"recipeYield":2}
    ]</script>`;

    expect(parseSchemaOrgRecipeHtml(html)).toMatchObject({
      title: "Toast",
      servings: 2,
      source: "@bread{2%slice}\n\nToast the bread.",
    });
  });

  it("rejects pages without a complete Recipe", () => {
    expect(parseSchemaOrgRecipeHtml(`<script type="application/ld+json">{"@type":"Article"}</script>`)).toBeNull();
    expect(parseSchemaOrgRecipeHtml(`<script type="application/ld+json">{"@type":"Recipe","name":"Empty"}</script>`)).toBeNull();
  });
});
