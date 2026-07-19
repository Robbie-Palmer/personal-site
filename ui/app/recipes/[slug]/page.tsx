import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RecipeContent } from "@/components/recipes/recipe-content";
import { RecipePagination } from "@/components/recipes/recipe-pagination";
import { JsonLdScript } from "@/components/seo/json-ld-script";
import {
  getAllRecipeSlugs,
  getRecipeBySlug,
  getRecipeNavigation,
  type RecipeDetailView,
} from "@/lib/api/recipes";
import { siteConfig } from "@/lib/config/site-config";
import { buildRecipeJsonLd } from "@/lib/seo/recipe-jsonld";

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
    const canonicalUrl =
      recipe.canonical || `${siteConfig.url}/recipes/${recipe.slug}`;
    return {
      title: recipe.title,
      description: recipe.description,
      alternates: {
        canonical: canonicalUrl,
        types: {
          "application/ld+json": `${siteConfig.url}/recipes/${recipe.slug}.json`,
        },
      },
    };
  } catch (_e) {
    return {
      title: "Recipe Not Found",
    };
  }
}

export default async function RecipePage(props: Readonly<PageProps>) {
  const params = await props.params;
  const { slug } = params;

  let recipe: RecipeDetailView;
  try {
    recipe = getRecipeBySlug(slug);
  } catch (_e) {
    notFound();
  }

  const { prevRecipe, nextRecipe } = getRecipeNavigation(slug);
  const jsonLd = buildRecipeJsonLd(
    recipe,
    siteConfig.author.name,
    `${siteConfig.url}/recipes/${recipe.slug}`,
  );

  return (
    <article className="container mx-auto px-4 pt-5 md:pt-6 pb-12 max-w-4xl">
      <JsonLdScript data={jsonLd} />
      <Link
        href="/recipes"
        className="rt-mono text-[var(--ink-3)] hover:text-[var(--terracotta)] mb-3 inline-block transition-colors"
      >
        &larr; Recipe box
      </Link>

      <RecipeContent recipe={recipe} />

      <RecipePagination
        prevRecipe={prevRecipe}
        nextRecipe={nextRecipe}
        className="mt-6"
      />
    </article>
  );
}
