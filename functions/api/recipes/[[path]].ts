import {
  proxyRecipeApiRequest,
  type RecipeApiProxyContext,
} from "../auth/routing";

export const onRequest = (context: RecipeApiProxyContext): Promise<Response> =>
  proxyRecipeApiRequest(
    context,
    "Recipe APIs are available on the canonical PR preview URL only",
    "Recipes",
    (path) => path.replace(/^\/api\/recipes/, "/recipes"),
  );
