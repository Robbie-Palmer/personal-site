import {
  proxyRecipeApiRequest,
  type RecipeApiProxyContext,
} from "../auth/routing";

export const onRequest = (context: RecipeApiProxyContext): Promise<Response> =>
  proxyRecipeApiRequest(
    context,
    "Household APIs are available on the canonical PR preview URL only",
    "Households",
    (path) =>
      path === "/api/households" || path.startsWith("/api/households/")
        ? path.replace(/^\/api\/households/, "/households")
        : "",
  );
