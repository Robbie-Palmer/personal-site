import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RecipeContent } from "@/components/recipes/recipe-content";
import {
  getAllRecipeSlugs,
  getRecipeBySlug,
  type RecipeDetailView,
} from "@/lib/api/recipes";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getAllRecipeSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  const { slug } = params;
  try {
    const recipe = getRecipeBySlug(slug);
    return {
      title: recipe.title,
      description: recipe.description,
    };
  } catch (_e) {
    return {
      title: "Recipe Not Found",
    };
  }
}

export default async function RecipePage(props: PageProps) {
  const params = await props.params;
  const { slug } = params;

  let recipe: RecipeDetailView;
  try {
    recipe = getRecipeBySlug(slug);
  } catch (_e) {
    notFound();
  }

  return (
    <article className="container mx-auto px-4 py-12 max-w-4xl">
      <Link
        href="/recipes"
        className="text-sm text-muted-foreground hover:text-foreground mb-8 inline-block"
      >
        &larr; Back to recipes
      </Link>

      <RecipeContent recipe={recipe} />
    </article>
  );
}
