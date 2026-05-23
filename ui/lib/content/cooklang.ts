import { CooklangParser } from "@cooklang/cooklang";
import { readdirSync, readFileSync } from "fs";
import matter from "gray-matter";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { buildRecipeContentFromParsed } from "@/lib/domain/recipe/cooklangTransform";
import type { RecipeContent } from "@/lib/domain/recipe/recipe";
import { RecipeFrontmatterSchema } from "@/lib/domain/recipe/recipe";

const _parser = new CooklangParser();

export function parseCookFile(
  fileContent: string,
  slug: string,
): RecipeContent {
  const { data, content: body } = matter(fileContent);
  const fm = RecipeFrontmatterSchema.parse(data);
  const [parsed] = _parser.parse(body);
  return buildRecipeContentFromParsed(parsed, fm, slug, body);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const RECIPES_DIR = join(__dirname, "..", "..", "content", "recipes");

export function loadRecipesFromCookFiles(): RecipeContent[] {
  const files = readdirSync(RECIPES_DIR).filter((f) => f.endsWith(".cook"));
  return files.map((file) => {
    const slug = file.replace(/\.cook$/, "");
    const content = readFileSync(join(RECIPES_DIR, file), "utf-8");
    return parseCookFile(content, slug);
  });
}
