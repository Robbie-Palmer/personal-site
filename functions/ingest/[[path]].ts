interface Env {
  POSTHOG_API_HOST?: string;
  POSTHOG_ASSETS_HOST?: string;
}

export interface IngestProxyContext {
  request: Request;
  env: Env;
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
    headers: context.request.headers,
    body: ["GET", "HEAD"].includes(context.request.method)
      ? undefined
      : context.request.body,
    redirect: "manual",
  };
  // Node's Fetch implementation requires this for streaming request bodies;
  // Workers ignores unknown RequestInit dictionary members.
  if (requestInit.body) requestInit.duplex = "half";
  const upstreamRequest = new Request(destination, requestInit);
  // Same-origin browser requests can carry credentials for this site. They are
  // not needed by PostHog and must not be forwarded to a third-party origin.
  for (const header of [
    "authorization",
    "cookie",
    "cf-connecting-ip",
    "x-forwarded-for",
    "x-real-ip",
  ]) {
    upstreamRequest.headers.delete(header);
  }

  try {
    const response = await fetch(upstreamRequest);
    console.log(
      JSON.stringify({
        message: "PostHog proxy request",
        method: context.request.method,
        path: `${pathname}${search}`,
        status: response.status,
      }),
    );
    return response;
  } catch (error) {
    console.error(
      JSON.stringify({
        message: "PostHog proxy request failed",
        method: context.request.method,
        path: `${pathname}${search}`,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    return Response.json(
      { error: "Analytics upstream unavailable" },
      { status: 502 },
    );
  }
};
