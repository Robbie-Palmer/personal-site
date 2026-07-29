import {
  proxyRecipeApiRequest,
  type RecipeApiProxyContext,
} from "../auth/routing";

export const onRequest = (context: RecipeApiProxyContext): Promise<Response> =>
  proxyRecipeApiRequest(
    context,
    "Cooking insights are available on the canonical PR preview URL only",
  );
