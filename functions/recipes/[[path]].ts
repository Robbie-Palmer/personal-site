import {
  escapeHtmlAttribute,
  escapeHtmlText,
  formatRecipeIngredientText,
  formatRecipeCooklang,
} from "recipe-domain/serialization";
import { isRecipeAppRouteSlug } from "recipe-domain/slugs";
import {
  proxyRecipeApiRequest,
  type RecipeApiProxyEnv,
} from "../api/auth/routing";
import {
  decodeRecipeResponse,
  loadPublicRecipe,
  type RecipePayload,
  recipeMarkdown,
} from "../lib/public-recipes";
import { rewrittenRecipeAssetHeaders } from "../lib/recipe-asset";

interface Env extends RecipeApiProxyEnv {
  ASSETS: { fetch: typeof fetch };
}

type Context = {
  request: Request;
  env: Env;
  next: () => Promise<Response>;
};

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
        group.items.map((item) =>
          formatRecipeIngredientText(item, { includeNote: true }),
        ),
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
  if (!SLUG.test(slug) || (!extension && isRecipeAppRouteSlug(slug))) {
    return context.next();
  }

  if (!extension) {
    const apiRequest = new Request(context.request.url, {
      method: "GET",
      headers: context.request.headers,
    });
    const apiResponse = await proxyRecipeApiRequest(
      { request: apiRequest, env: context.env },
      "Recipe pages are available on the canonical PR preview URL only",
    );
    const loaded = await decodeRecipeResponse(apiResponse);
    if (!loaded) return new Response("Not found", { status: 404 });
    if (
      loaded.record.visibility === "public" &&
      (context.request.headers.get("accept") ?? "").includes("text/markdown")
    ) {
      return textResponse(recipeMarkdown(loaded.payload), "text/markdown");
    }
    const assetUrl = new URL("/recipes/saved.html", url);
    const assetHeaders = new Headers(context.request.headers);
    assetHeaders.delete("if-none-match");
    assetHeaders.delete("if-modified-since");
    const asset = await context.env.ASSETS.fetch(
      new Request(assetUrl, {
        method: context.request.method,
        headers: assetHeaders,
      }),
    );
    if (!asset.ok || context.request.method === "HEAD") return asset;
    const description =
      loaded.payload.recipe.description ||
      loaded.record.description ||
      loaded.payload.recipe.title;
    const isPublic = loaded.record.visibility === "public";
    const headMarkup = isPublic
      ? `<link rel="canonical" href="${escapeHtmlAttribute(
          `${url.origin}/recipes/${slug}`,
        )}">` +
        `<script type="application/ld+json">${recipeJsonLd(
          loaded.payload,
          url,
          slug,
        ).trim()}</script>`
      : "";
    let html = (await asset.text())
      .replace(
        /<title>[\s\S]*?<\/title>/,
        `<title>${escapeHtmlText(loaded.payload.recipe.title)}</title>`,
      )
      .replace(
        /<meta name="description" content="[^"]*"\s*\/?>/i,
        `<meta name="description" content="${escapeHtmlAttribute(description)}">`,
      )
      .replace("</head>", `${headMarkup}</head>`);
    if (isPublic) {
      html = html.replace(/<meta name="robots"[^>]*>/i, "");
    }
    const headers = rewrittenRecipeAssetHeaders(
      asset,
      isPublic
        ? "public, max-age=60, s-maxage=300"
        : "private, no-store",
    );
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
