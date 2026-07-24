import { describe, expect, it } from "vitest";
import { parseRecipeFile } from "../../src/lib/recipe-file.js";

describe("parseRecipeFile", () => {
  it("imports Cooklang frontmatter and body into an editable draft", async () => {
    const source = `---
title: "Weeknight pasta"
description: "A quick dinner."
cuisine: ["Italian"]
servings: 2
prepTime: 5
cookTime: 20
canonical: "https://recipes.example.test/weeknight-pasta"
---
@pasta{200%g}
@tomatoes{400%g}

Boil the pasta, then stir in the tomatoes.`;

    await expect(
      parseRecipeFile("weeknight-pasta.cook", source),
    ).resolves.toEqual({
      title: "Weeknight pasta",
      description: "A quick dinner.",
      cuisine: "Italian",
      servings: 2,
      prepTime: 5,
      cookTime: 20,
      url: "https://recipes.example.test/weeknight-pasta",
      source:
        "@pasta{200%g}\n@tomatoes{400%g}\n\nBoil the pasta, then stir in the tomatoes.",
    });
  });

  it("uses the filename and editable defaults when metadata is absent", async () => {
    await expect(
      parseRecipeFile(
        "lemon-rice.cooklang",
        "@rice{200%g}\n\nCook the rice with @lemon{1}.",
      ),
    ).resolves.toMatchObject({
      title: "lemon rice",
      description: "Recipe for lemon rice, imported from a Cooklang file.",
      cuisine: "",
      servings: 1,
    });
  });

  it("rejects unsupported and incomplete files", async () => {
    await expect(parseRecipeFile("recipe.txt", "Cook.")).resolves.toBeNull();
    await expect(
      parseRecipeFile("recipe.cook", "There are no ingredients here."),
    ).resolves.toBeNull();
  });
});
