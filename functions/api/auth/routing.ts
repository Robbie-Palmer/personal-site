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

const MAX_PROXY_PATH_LENGTH = 2_048;

function isUnsafePathSegment(segment: string): boolean {
  let decoded = segment;
  for (let pass = 0; pass < 10; pass += 1) {
    const next = decodeURIComponent(decoded);
    if (next === decoded) {
      return (
        decoded === "." ||
        decoded === ".." ||
        decoded.includes("/") ||
        decoded.includes("\\") ||
        decoded.includes("\0")
      );
    }
    decoded = next;
  }

  // Reject path segments that remain multiply encoded after a generous limit.
  return true;
}

function resolveDestinationPath(
  pathname: string,
  rewritePath?: (path: string) => string,
): string | null {
  const destinationPath = rewritePath?.(pathname) ?? pathname;
  if (
    !destinationPath.startsWith("/") ||
    destinationPath.length > MAX_PROXY_PATH_LENGTH
  )
    return null;

  try {
    const segments = destinationPath.split("/");
    const hasEmptyMiddleSegment = segments.slice(1, -1).includes("");
    const hasUnsafeSegment = segments.some(isUnsafePathSegment);
    return hasEmptyMiddleSegment || hasUnsafeSegment ? null : destinationPath;
  } catch {
    return null;
  }
}

const FORWARDED_REQUEST_HEADERS = [
  "accept",
  "authorization",
  "cf-access-jwt-assertion",
  "cf-connecting-ip",
  "content-type",
  "cookie",
  "origin",
  "referer",
  "user-agent",
  "x-forwarded-for",
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
  rewritePath?: (path: string) => string,
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

  const destinationPath = resolveDestinationPath(url.pathname, rewritePath);
  if (!destinationPath) {
    return Response.json({ error: "Invalid API path" }, { status: 400 });
  }

  const destinationUrl = new URL(apiBase);
  destinationUrl.pathname = destinationPath;
  destinationUrl.search = url.search;
  const destination = destinationUrl.toString();
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
        destination: `${apiBase}${destinationPath}`,
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
