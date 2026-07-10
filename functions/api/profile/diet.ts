import { previewApiBase } from "../auth/routing";

interface Env {
  RECIPE_API_URL?: string;
  RECIPE_API_PREVIEW_ORIGIN_TEMPLATE?: string;
  CF_PAGES_HOST?: string;
}

type PagesContext = {
  request: Request;
  env: Env;
};

export async function onRequest(context: PagesContext): Promise<Response> {
  const url = new URL(context.request.url);
  const previewBase = previewApiBase(url, context.env);
  if (previewBase === null) {
    return Response.json(
      { error: "Profile APIs are available on the canonical PR preview URL only" },
      { status: 503 },
    );
  }

  const apiBase =
    previewBase ||
    context.env.RECIPE_API_URL ||
    "https://recipe-api.robbiepalmer95.workers.dev";
  const destination = `${apiBase}${url.pathname}${url.search}`;

  const headers = new Headers(context.request.headers);
  headers.delete("host");

  const hasBody = !["GET", "HEAD"].includes(context.request.method);
  const body = hasBody ? await context.request.arrayBuffer() : undefined;
  return fetch(
    new Request(destination, {
      method: context.request.method,
      headers,
      body,
      redirect: "manual",
    }),
  );
}
