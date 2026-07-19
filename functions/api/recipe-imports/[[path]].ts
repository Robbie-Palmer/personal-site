import {
  proxyRecipeApiRequest,
  type RecipeApiProxyContext,
} from "../auth/routing";

export const onRequest = (context: RecipeApiProxyContext): Promise<Response> =>
  proxyRecipeApiRequest(
    context,
    "Recipe imports are available on the canonical PR preview URL only",
    "Recipe imports",
    (path) =>
      path === "/api/recipe-imports" || path.startsWith("/api/recipe-imports/")
        ? path.replace(/^\/api\/recipe-imports/, "/recipe-imports")
        : "",
  );
