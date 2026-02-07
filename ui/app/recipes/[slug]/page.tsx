import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/markdown";
import {
  getAllRecipeSlugs,
  getRecipeBySlug,
  type RecipeDetailView,
} from "@/lib/api/recipes";
import { formatDate } from "@/lib/generic/date";

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
        ← Back to recipes
      </Link>

      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-4">{recipe.title}</h1>
        <p className="text-xl text-muted-foreground mb-4">
          {recipe.description}
        </p>

        <div className="text-sm text-muted-foreground">
          <time>{formatDate(recipe.date)}</time>
        </div>
      </header>

      <Markdown source={recipe.content} />
    </article>
  );
}
