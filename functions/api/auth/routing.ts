export type AuthProxyRoutingEnv = {
  RECIPE_API_PREVIEW_ORIGIN_TEMPLATE?: string;
  CF_PAGES_HOST?: string;
};

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
