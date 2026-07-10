import {
  proxyRecipeApiRequest,
  type RecipeApiProxyEnv,
} from "../auth/routing";

type PagesContext = {
  request: Request;
  env: RecipeApiProxyEnv;
};

export const onRequest = (context: PagesContext): Promise<Response> =>
  proxyRecipeApiRequest(
    context,
    "Profile APIs are available on the canonical PR preview URL only",
  );
