interface Env {
  POSTHOG_API_HOST?: string;
  POSTHOG_ASSETS_HOST?: string;
}

export interface IngestProxyContext {
  request: Request;
  env: Env;
}

const FORWARDED_HEADERS = [
  "accept",
  "content-encoding",
  "content-length",
  "content-type",
  "user-agent",
] as const;

function postHogHeaders(request: Request): Headers {
  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  return headers;
}

export const onRequest = async (
  context: IngestProxyContext,
): Promise<Response> => {
  const apiHost = context.env.POSTHOG_API_HOST || "https://eu.i.posthog.com";
  const assetsHost =
    context.env.POSTHOG_ASSETS_HOST || "https://eu-assets.i.posthog.com";

  const url = new URL(context.request.url);
  const pathname = url.pathname.replace(/^\/ingest/, "");
  const search = url.search;

  const destination = pathname.startsWith("/static/")
    ? `${assetsHost}${pathname}${search}`
    : `${apiHost}${pathname}${search}`;

  const requestInit: RequestInit & { duplex?: "half" } = {
    method: context.request.method,
    headers: postHogHeaders(context.request),
    body: ["GET", "HEAD"].includes(context.request.method)
      ? undefined
      : context.request.body,
    redirect: "manual",
  };
  // Node's Fetch implementation requires this for streaming request bodies;
  // Workers ignores unknown RequestInit dictionary members.
  if (requestInit.body) requestInit.duplex = "half";
  const upstreamRequest = new Request(destination, requestInit);

  try {
    const response = await fetch(upstreamRequest);
    console.log(
      JSON.stringify({
        message: "PostHog proxy request",
        method: context.request.method,
        path: pathname,
        status: response.status,
      }),
    );
    return response;
  } catch (error) {
    console.error(
      JSON.stringify({
        message: "PostHog proxy request failed",
        method: context.request.method,
        path: pathname,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    return Response.json(
      { error: "Analytics upstream unavailable" },
      { status: 502 },
    );
  }
};
