import { describe, expect, it } from "vitest";
import {
  parseSchemaOrgRecipeHtml,
  parseSchemaOrgRecipeJson,
} from "../../src/lib/schema-org.js";

describe("parseSchemaOrgRecipeHtml", () => {
  it("imports a Recipe from a JSON-LD graph into Cooklang source", async () => {
    const html = `<!doctype html><script type="application/ld+json">
      {"@context":"https://schema.org","@graph":[
        {"@type":"WebPage","name":"Dinner"},
        {"@type":["Thing","Recipe"],"name":"Tomato &amp; Basil Pasta","author":"Test Cook",
         "image":"https://example.com/pasta.jpg",
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

    await expect(parseSchemaOrgRecipeHtml(html)).resolves.toEqual({
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

  it("supports a top-level array and plain instruction strings", async () => {
    const html = `<script TYPE='application/ld+json'>[
      {"@type":"BreadcrumbList"},
      {"@type":"https://schema.org/Recipe","name":"Toast","author":"Test Cook",
       "image":"https://example.com/toast.jpg","description":"Toast.","recipeIngredient":["2 slices bread"],
       "recipeInstructions":["Toast the bread."],"recipeYield":2}
    ]</script>`;

    await expect(parseSchemaOrgRecipeHtml(html)).resolves.toMatchObject({
      title: "Toast",
      servings: 2,
      source: "@bread{2%slice}\n\nToast the bread.",
    });
  });

  it.each([
    ["HTML comments", "<!--", "-->"],
    ["HTML comments with a bang", "<!--", "--!>"],
    ["CDATA comments", "//<![CDATA[", "//]]>"],
  ])("unwraps JSON-LD inside %s", async (_name, prefix, suffix) => {
    const html = `<script type="application/ld+json">${prefix}
      {"@type":"Recipe","name":"Toast","author":"Test Cook",
       "image":"https://example.com/toast.jpg","description":"Toast.","recipeIngredient":["2 slices bread"],
       "recipeInstructions":["Toast the bread."]}
      ${suffix}</script>`;

    await expect(parseSchemaOrgRecipeHtml(html)).resolves.toMatchObject({ title: "Toast" });
  });

  it("rejects pages without a complete Recipe", async () => {
    await expect(parseSchemaOrgRecipeHtml(`<script type="application/ld+json">{"@type":"Article"}</script>`)).resolves.toBeNull();
    await expect(parseSchemaOrgRecipeHtml(`<script type="application/ld+json">{"@type":"Recipe","name":"Empty"}</script>`)).resolves.toBeNull();
  });

  it("imports standalone JSON-LD and preserves its canonical URL", async () => {
    const source = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebPage", name: "Dinner" },
        {
          "@type": "Recipe",
          name: "Tomato pasta",
          url: "https://recipes.example.test/tomato-pasta",
          description: "A quick dinner.",
          recipeYield: "2 servings",
          recipeIngredient: ["200 g pasta", "400 g tomatoes"],
          recipeInstructions: ["Boil the pasta.", "Add the tomatoes."],
        },
      ],
    });

    await expect(parseSchemaOrgRecipeJson(source)).resolves.toMatchObject({
      title: "Tomato pasta",
      servings: 2,
      url: "https://recipes.example.test/tomato-pasta",
      source:
        "@pasta{200%g}\n@tomatoes{400%g}\n\nBoil the pasta.\n\nAdd the tomatoes.",
    });
  });

  it("rejects malformed standalone JSON-LD", async () => {
    await expect(parseSchemaOrgRecipeJson("{")).resolves.toBeNull();
    await expect(
      parseSchemaOrgRecipeJson(JSON.stringify({ "@type": "Article" })),
    ).resolves.toBeNull();
  });
});
