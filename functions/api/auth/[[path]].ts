import { previewApiBase } from "./routing";

interface Env {
  RECIPE_API_URL?: string;
  RECIPE_API_PREVIEW_ORIGIN_TEMPLATE?: string;
  CF_PAGES_HOST?: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const previewBase = previewApiBase(url, context.env);
  if (previewBase === null) {
    return Response.json(
      { error: "Auth is available on the canonical PR preview URL only" },
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

  console.log(
    JSON.stringify({
      message: "Auth proxy request",
      method: context.request.method,
      path: url.pathname,
      destination: `${apiBase}${url.pathname}`,
    }),
  );

  const hasBody = !["GET", "HEAD"].includes(context.request.method);

  const response = await fetch(
    new Request(destination, {
      method: context.request.method,
      headers,
      body: hasBody ? context.request.body : undefined,
      redirect: "manual",
    }),
  );

  console.log(
    JSON.stringify({
      message: "Auth proxy response",
      status: response.status,
    }),
  );
  return response;
};
