export type AuthProxyRoutingEnv = {
  RECIPE_API_PREVIEW_ORIGIN_TEMPLATE?: string;
  CF_PAGES_HOST?: string;
};

export type RecipeApiProxyEnv = AuthProxyRoutingEnv & {
  RECIPE_API_URL?: string;
};

export type RecipeApiProxyContext = {
  request: Request;
  env: RecipeApiProxyEnv;
};

const FORWARDED_REQUEST_HEADERS = [
  "accept",
  "authorization",
  "content-type",
  "cookie",
  "origin",
  "referer",
  "user-agent",
] as const;

export function previewApiBase(
  requestURL: URL,
  env: AuthProxyRoutingEnv,
): string | null | undefined {
  if (!env.CF_PAGES_HOST || !env.RECIPE_API_PREVIEW_ORIGIN_TEMPLATE) {
    return undefined;
  }

  const pagesHost = env.CF_PAGES_HOST.toLowerCase();
  const requestHost = requestURL.hostname.toLowerCase();
  if (requestHost === pagesHost || !requestHost.endsWith(`.${pagesHost}`)) {
    return undefined;
  }

  const alias = requestHost.slice(0, -(pagesHost.length + 1));
  const match = /^pr-(\d+)$/.exec(alias);
  const prNumber = match?.[1];
  if (!prNumber) return null;

  const candidate = env.RECIPE_API_PREVIEW_ORIGIN_TEMPLATE.replace(
    "{pr}",
    prNumber,
  );
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

export async function proxyRecipeApiRequest(
  context: RecipeApiProxyContext,
  invalidPreviewMessage: string,
  logLabel?: string,
): Promise<Response> {
  const url = new URL(context.request.url);
  const previewBase = previewApiBase(url, context.env);
  if (previewBase === null) {
    return Response.json({ error: invalidPreviewMessage }, { status: 503 });
  }

  const apiBase = previewBase || context.env.RECIPE_API_URL;
  if (!apiBase) {
    return Response.json(
      { error: "Recipe API URL is not configured" },
      { status: 503 },
    );
  }

  const destination = `${apiBase}${url.pathname}${url.search}`;
  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = context.request.headers.get(name);
    if (value) headers.set(name, value);
  }

  if (logLabel) {
    console.log(
      JSON.stringify({
        message: `${logLabel} proxy request`,
        method: context.request.method,
        path: url.pathname,
        destination: `${apiBase}${url.pathname}`,
      }),
    );
  }

  const body = ["GET", "HEAD"].includes(context.request.method)
    ? undefined
    : await context.request.arrayBuffer();

  let response: Response;
  try {
    response = await fetch(
      new Request(destination, {
        method: context.request.method,
        headers,
        body,
        redirect: "manual",
      }),
    );
  } catch (error) {
    if (logLabel) {
      console.error(
        JSON.stringify({
          message: `${logLabel} proxy request failed`,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
    return Response.json(
      { error: "Failed to reach the recipe API" },
      { status: 502 },
    );
  }

  if (logLabel) {
    console.log(
      JSON.stringify({
        message: `${logLabel} proxy response`,
        status: response.status,
      }),
    );
  }

  return response;
}
