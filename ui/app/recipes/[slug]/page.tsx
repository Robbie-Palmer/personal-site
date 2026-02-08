import { Clock, Timer, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  getAllRecipeSlugs,
  getRecipeBySlug,
  type RecipeDetailView,
} from "@/lib/api/recipes";
import type {
  IngredientGroupView,
  RecipeIngredientView,
} from "@/lib/domain/recipe";
import { UNIT_LABELS } from "@/lib/domain/recipe";

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

function formatAmount(item: RecipeIngredientView): string {
  const parts: string[] = [];

  if (item.amount != null) {
    parts.push(item.amount.toString());
  }

  if (item.unit) {
    const labels = UNIT_LABELS[item.unit];
    if (labels) {
      const label =
        item.amount != null && item.amount !== 1
          ? labels.plural
          : labels.singular;
      if (label) {
        parts.push(label);
      }
    }
  }

  return parts.join(" ");
}

function formatIngredient(item: RecipeIngredientView): string {
  const amount = formatAmount(item);
  const parts: string[] = [];

  if (amount) {
    parts.push(amount);
  }

  parts.push(item.name);

  if (item.preparation) {
    parts.push(`(${item.preparation})`);
  }

  if (item.note) {
    parts.push(`\u2013 ${item.note}`);
  }

  return parts.join(" ");
}

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function IngredientGroup({ group }: { group: IngredientGroupView }) {
  return (
    <div>
      {group.name && (
        <h3 className="font-semibold text-lg mb-2">{group.name}</h3>
      )}
      <ul className="space-y-1">
        {group.items.map((item) => (
          <li key={item.ingredient} className="flex items-start gap-2">
            <span className="text-muted-foreground mt-1.5 h-1.5 w-1.5 rounded-full bg-current flex-shrink-0" />
            <span>{formatIngredient(item)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
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

      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-4">{recipe.title}</h1>
        <p className="text-xl text-muted-foreground mb-4">
          {recipe.description}
        </p>

        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>{recipe.servings} servings</span>
          </div>
          {recipe.prepTime != null && (
            <div className="flex items-center gap-1">
              <Timer className="h-4 w-4" />
              <span>Prep: {formatTime(recipe.prepTime)}</span>
            </div>
          )}
          {recipe.cookTime != null && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>Cook: {formatTime(recipe.cookTime)}</span>
            </div>
          )}
          {recipe.totalTime != null && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>Total: {formatTime(recipe.totalTime)}</span>
            </div>
          )}
        </div>

        {recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {recipe.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </header>

      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Ingredients</h2>
        <div className="space-y-4">
          {recipe.ingredientGroups.map((group, i) => (
            <IngredientGroup key={group.name ?? i} group={group} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">Instructions</h2>
        <ol className="space-y-3 list-decimal list-inside">
          {recipe.instructions.map((step, i) => (
            <li key={i} className="leading-relaxed pl-2">
              {step}
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
}
