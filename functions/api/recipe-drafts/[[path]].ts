import {
  proxyRecipeApiRequest,
  type RecipeApiProxyContext,
} from "../auth/routing";

export const onRequest = (context: RecipeApiProxyContext): Promise<Response> =>
  proxyRecipeApiRequest(
    context,
    "Recipe draft APIs are available on the canonical PR preview URL only",
    "Recipe drafts",
    (path) =>
      path === "/api/recipe-drafts" || path.startsWith("/api/recipe-drafts/")
        ? path.replace(/^\/api\/recipe-drafts/, "/recipe-drafts")
        : "",
  );
