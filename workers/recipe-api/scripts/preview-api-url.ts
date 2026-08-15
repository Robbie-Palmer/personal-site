export function previewApiRequestURL(apiURL: URL, path: string): URL {
  // Some paths contain IDs returned by the preview API. Keep those values from
  // turning a same-origin smoke-test request into an attacker-controlled URL.
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.trim() !== path ||
    /[\u0000-\u001f\u007f]/u.test(path)
  ) {
    throw new TypeError(
      "Preview API path must be root-relative and contain no surrounding whitespace or control characters",
    );
  }
  const requestURL = new URL(path, apiURL);
  if (requestURL.origin !== apiURL.origin) {
    throw new TypeError(`Preview API URL must stay on ${apiURL.origin}`);
  }
  return requestURL;
}
