interface Env {
  POSTHOG_API_HOST?: string;
  POSTHOG_ASSETS_HOST?: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const apiHost = context.env.POSTHOG_API_HOST || "https://eu.i.posthog.com";
  const assetsHost =
    context.env.POSTHOG_ASSETS_HOST || "https://eu-assets.i.posthog.com";

  const url = new URL(context.request.url);
  const pathname = url.pathname.replace(/^\/ingest/, "");
  const search = url.search; // Preserve query string

  const destination = pathname.startsWith("/static/")
    ? `${assetsHost}${pathname}${search}`
    : `${apiHost}${pathname}${search}`;

  return fetch(new Request(destination, context.request));
};
