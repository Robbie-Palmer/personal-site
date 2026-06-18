interface Env {
  RECIPE_API_URL?: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const apiBase =
    context.env.RECIPE_API_URL || "https://recipe-api.robbiepalmer95.workers.dev";

  const url = new URL(context.request.url);
  const destination = `${apiBase}${url.pathname}${url.search}`;

  const headers = new Headers(context.request.headers);

  console.log(
    `[Auth Proxy] ${context.request.method} ${url.pathname}${url.search} -> ${destination}`,
  );

  const response = await fetch(
    new Request(destination, {
      method: context.request.method,
      headers,
      body: context.request.body,
      redirect: "manual",
    }),
  );

  console.log(`[Auth Proxy] Response: ${response.status}`);
  return response;
};
