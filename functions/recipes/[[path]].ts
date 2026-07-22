import {
  escapeHtmlAttribute,
  escapeHtmlText,
  formatRecipeCooklang,
} from "recipe-domain/serialization";
import {
  loadPublicRecipe,
  type PublicRecipeEnv,
  type RecipePayload,
  recipeMarkdown,
} from "../lib/public-recipes";

interface Env extends PublicRecipeEnv {
  ASSETS: { fetch: typeof fetch };
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

function textResponse(body: string, contentType: string): Response {
  return new Response(body, {
    headers: {
      "cache-control": "public, max-age=60, s-maxage=300",
      "content-type": `${contentType}; charset=utf-8`,
    },
  });
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
    const loaded = await loadPublicRecipe(context.env, slug);
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
      `<link rel="canonical" href="${escapeHtmlAttribute(`${url.origin}/recipes/${slug}`)}">` +
      `<script type="application/ld+json">${recipeJsonLd(
        loaded.payload,
        url,
        slug,
      ).trim()}</script>`;
    const html = (await asset.text())
      .replace(
        /<title>[\s\S]*?<\/title>/,
        `<title>${escapeHtmlText(loaded.payload.recipe.title)}</title>`,
      )
      .replace(
        /<meta name="description" content="[^"]*"\s*\/?>/i,
        `<meta name="description" content="${escapeHtmlAttribute(description)}">`,
      )
      .replace(/<meta name="robots"[^>]*>/i, "")
      .replace("</head>", `${headMarkup}</head>`);
    const headers = new Headers(asset.headers);
    headers.delete("content-length");
    return new Response(html, { status: asset.status, headers });
  }

  const loaded = await loadPublicRecipe(context.env, slug);
  if (!loaded) return new Response("Not found", { status: 404 });
  if (extension === "md") {
    return textResponse(recipeMarkdown(loaded.payload), "text/markdown");
  }
  if (extension === "cook") {
    return textResponse(
      formatRecipeCooklang(loaded.payload.recipe, loaded.payload.source),
      "text/plain",
    );
  }
  return textResponse(
    recipeJsonLd(loaded.payload, url, slug),
    "application/ld+json",
  );
};
