export function previewApiRequestURL(apiURL: URL, path: string): URL {
  // Some paths contain IDs returned by the preview API. Keep those values from
  // turning a same-origin smoke-test request into an attacker-controlled URL.
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new TypeError(`Preview API path must be root-relative: ${path}`);
  }
  const requestURL = new URL(path, apiURL);
  if (requestURL.origin !== apiURL.origin) {
    throw new TypeError(`Preview API URL must stay on ${apiURL.origin}`);
  }
  return requestURL;
}
