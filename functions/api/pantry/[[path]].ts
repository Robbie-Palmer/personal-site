import {
  proxyRecipeApiRequest,
  type RecipeApiProxyContext,
} from "../auth/routing";

export const onRequest = (context: RecipeApiProxyContext): Promise<Response> =>
  proxyRecipeApiRequest(
    context,
    "Pantry APIs are available on the canonical PR preview URL only",
    "Pantry",
    (path) =>
      path === "/api/pantry" || path.startsWith("/api/pantry/")
        ? path.replace(/^\/api\/pantry/, "/pantry")
        : "",
  );
