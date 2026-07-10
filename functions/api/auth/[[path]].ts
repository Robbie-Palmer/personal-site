import { proxyRecipeApiRequest, type RecipeApiProxyEnv } from "./routing";

export const onRequest: PagesFunction<RecipeApiProxyEnv> = (context) =>
  proxyRecipeApiRequest(
    context,
    "Auth is available on the canonical PR preview URL only",
    "Auth",
  );
