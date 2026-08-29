import {
  proxyRecipeApiRequest,
  type RecipeApiProxyContext,
} from "../auth/routing";

export const onRequest = (context: RecipeApiProxyContext): Promise<Response> =>
  proxyRecipeApiRequest(
    context,
    "Shopping-list APIs are available on the canonical PR preview URL only",
    "Shopping lists",
    (path) =>
      path === "/api/shopping-lists" ||
      path.startsWith("/api/shopping-lists/")
        ? path.replace(/^\/api/, "")
        : "",
  );
