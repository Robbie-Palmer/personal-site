import {
  proxyRecipeApiRequest,
  type RecipeApiProxyEnv,
} from "../api/auth/routing";

export const onRequest: PagesFunction<RecipeApiProxyEnv> = (context) =>
  proxyRecipeApiRequest(
    context,
    "Agent Auth discovery is available on the canonical PR preview URL only",
    "Agent Auth discovery",
  );
