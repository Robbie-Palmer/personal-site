interface Env {
  ASSETS: { fetch: typeof fetch };
  RECIPE_API_URL?: string;
}

type Context = {
  request: Request;
  env: Env;
  next: () => Promise<Response>;
};

const APP_ROUTES = new Set([
  "add",
  "cooks",
  "discover",
  "kitchen",
  "notifications",
  "onboarding",
  "profile",
  "saved",
  "settings",
  "shopping",
]);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type StoredRecipe = {
  slug: string;
  title: string;
  description: string | null;
  body: string | null;
};

type RecipePayload = {
  version: 1;
  source: string;
  recipe: {
    title: string;
    description: string;
    date: string;
    cuisine: string[];
    servings: number;
    prepTime?: number;
    cookTime?: number;
    tags: string[];
    image?: string;
    imageAlt?: string;
    canonical?: string;
    ingredientGroups: {
      name?: string;
      items: {
        ingredient: string;
        amount?: number;
        unit?: string;
        preparation?: string;
        note?: string;
      }[];
    }[];
    instructions: string[];
    cookware: string[];
  };
};

async function loadPublicRecipe(
  context: Context,
  slug: string,
): Promise<{ record: StoredRecipe; payload: RecipePayload } | null> {
  if (!context.env.RECIPE_API_URL) return null;
  const apiUrl = new URL(`/recipes/${slug}`, context.env.RECIPE_API_URL);
  const response = await fetch(apiUrl, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) return null;
  const record = (await response.json()) as StoredRecipe;
  if (!record.body) return null;
  try {
    const payload = JSON.parse(record.body) as RecipePayload;
    return payload.version === 1 ? { record, payload } : null;
  } catch {
    return null;
  }
}

function textResponse(body: string, contentType: string): Response {
  return new Response(body, {
    headers: {
      "cache-control": "public, max-age=60, s-maxage=300",
      "content-type": `${contentType}; charset=utf-8`,
    },
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function recipeMarkdown(payload: RecipePayload): string {
  const recipe = payload.recipe;
  const facts = [
    `- Servings: ${recipe.servings}`,
    ...(recipe.prepTime == null ? [] : [`- Prep time: ${recipe.prepTime} min`]),
    ...(recipe.cookTime == null ? [] : [`- Cook time: ${recipe.cookTime} min`]),
    ...(recipe.cuisine.length === 0
      ? []
      : [`- Cuisine: ${recipe.cuisine.join(", ")}`]),
  ];
  const ingredients = recipe.ingredientGroups.flatMap((group) => [
    ...(group.name ? [`### ${group.name}`, ""] : []),
    ...group.items.map((item) => {
      const quantity = [item.amount, item.unit].filter(Boolean).join(" ");
      const detail = [item.preparation, item.note].filter(Boolean).join(", ");
      const ingredient = [quantity, item.ingredient.replaceAll("-", " ")]
        .filter(Boolean)
        .join(" ");
      const detailSuffix = detail ? ` (${detail})` : "";
      return `- ${ingredient}${detailSuffix}`;
    }),
    "",
  ]);
  return [
    `# ${recipe.title}`,
    "",
    recipe.description,
    "",
    ...facts,
    "",
    "## Ingredients",
    "",
    ...ingredients,
    "## Instructions",
    "",
    ...recipe.instructions.map(
      (instruction, index) => `${index + 1}. ${instruction}`,
    ),
    "",
  ].join("\n");
}

function recipeCooklang(payload: RecipePayload): string {
  const recipe = payload.recipe;
  const frontmatter = [
    "---",
    `title: ${JSON.stringify(recipe.title)}`,
    `description: ${JSON.stringify(recipe.description)}`,
    `date: ${JSON.stringify(recipe.date)}`,
    `cuisine: ${JSON.stringify(recipe.cuisine)}`,
    `servings: ${recipe.servings}`,
    ...(recipe.prepTime == null ? [] : [`prepTime: ${recipe.prepTime}`]),
    ...(recipe.cookTime == null ? [] : [`cookTime: ${recipe.cookTime}`]),
    `tags: ${JSON.stringify(recipe.tags)}`,
    ...(recipe.image ? [`image: ${JSON.stringify(recipe.image)}`] : []),
    ...(recipe.imageAlt
      ? [`imageAlt: ${JSON.stringify(recipe.imageAlt)}`]
      : []),
    ...(recipe.canonical
      ? [`canonical: ${JSON.stringify(recipe.canonical)}`]
      : []),
    "---",
  ];
  return `${frontmatter.join("\n")}\n${payload.source.trim()}\n`;
}

function recipeJsonLd(payload: RecipePayload, url: URL, slug: string): string {
  const recipe = payload.recipe;
  const json = JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: recipe.title,
      description: recipe.description,
      datePublished: recipe.date,
      recipeYield: String(recipe.servings),
      recipeCuisine: recipe.cuisine,
      recipeIngredient: recipe.ingredientGroups.flatMap((group) =>
        group.items.map((item) => item.ingredient.replaceAll("-", " ")),
      ),
      recipeInstructions: recipe.instructions.map((text) => ({
        "@type": "HowToStep",
        text,
      })),
      url: `${url.origin}/recipes/${slug}`,
    },
    null,
    2,
  ).replaceAll("<", String.raw`\u003c`);
  return `${json}\n`;
}

export const onRequest = async (context: Context): Promise<Response> => {
  const url = new URL(context.request.url);
  const relativePath = url.pathname.replace(/^\/recipes\/?/, "");
  if (!relativePath || relativePath.includes("/")) return context.next();

  const extension = /\.(md|json|cook)$/.exec(relativePath)?.[1];
  const slug = extension
    ? relativePath.slice(0, -(extension.length + 1))
    : relativePath;
  if (!SLUG.test(slug) || (!extension && APP_ROUTES.has(slug))) {
    return context.next();
  }

  if (!extension) {
    const loaded = await loadPublicRecipe(context, slug);
    if (!loaded) return new Response("Not found", { status: 404 });
    if (
      (context.request.headers.get("accept") ?? "").includes("text/markdown")
    ) {
      return textResponse(recipeMarkdown(loaded.payload), "text/markdown");
    }
    const assetUrl = new URL("/recipes/saved.html", url);
    const asset = await context.env.ASSETS.fetch(
      new Request(assetUrl, {
        method: context.request.method,
        headers: context.request.headers,
      }),
    );
    if (!asset.ok || context.request.method === "HEAD") return asset;
    const description =
      loaded.payload.recipe.description ||
      loaded.record.description ||
      loaded.payload.recipe.title;
    const headMarkup =
      `<link rel="canonical" href="${url.origin}/recipes/${slug}">` +
      `<script type="application/ld+json">${recipeJsonLd(
        loaded.payload,
        url,
        slug,
      ).trim()}</script>`;
    const html = (await asset.text())
      .replace(
        /<title>[\s\S]*?<\/title>/,
        `<title>${escapeHtml(loaded.payload.recipe.title)}</title>`,
      )
      .replace(
        /<meta name="description" content="[^"]*"\s*\/?>/i,
        `<meta name="description" content="${escapeHtml(description)}">`,
      )
      .replace(/<meta name="robots"[^>]*>/i, "")
      .replace("</head>", `${headMarkup}</head>`);
    const headers = new Headers(asset.headers);
    headers.delete("content-length");
    return new Response(html, { status: asset.status, headers });
  }

  const loaded = await loadPublicRecipe(context, slug);
  if (!loaded) return new Response("Not found", { status: 404 });
  if (extension === "md") {
    return textResponse(recipeMarkdown(loaded.payload), "text/markdown");
  }
  if (extension === "cook") {
    return textResponse(recipeCooklang(loaded.payload), "text/plain");
  }
  return textResponse(
    recipeJsonLd(loaded.payload, url, slug),
    "application/ld+json",
  );
};
