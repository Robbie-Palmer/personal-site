import {
  proxyRecipeApiRequest,
  type RecipeApiProxyContext,
} from "../auth/routing";

export const onRequest = (context: RecipeApiProxyContext): Promise<Response> =>
  proxyRecipeApiRequest(
    context,
    "Notification APIs are available on the canonical PR preview URL only",
    "Notifications",
    (path) =>
      path === "/api/notifications" || path.startsWith("/api/notifications/")
        ? path.replace(/^\/api/, "")
        : "",
  );
