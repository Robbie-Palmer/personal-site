function assertPreviewApiOrigin(apiURL: URL): void {
  if (
    apiURL.protocol !== "https:" ||
    apiURL.username !== "" ||
    apiURL.password !== "" ||
    apiURL.pathname !== "/" ||
    apiURL.search !== "" ||
    apiURL.hash !== ""
  ) {
    throw new TypeError(
      "PREVIEW_API_URL must be an HTTPS origin without credentials, a path, a query, or a fragment",
    );
  }
}

export function previewApiBaseURL(value: string): URL {
  let apiURL: URL;
  try {
    apiURL = new URL(value);
  } catch {
    throw new TypeError("PREVIEW_API_URL must be a valid HTTPS origin");
  }
  assertPreviewApiOrigin(apiURL);
  return apiURL;
}

export function previewApiRequestURL(apiURL: URL, path: string): URL {
  assertPreviewApiOrigin(apiURL);
  // Some paths contain IDs returned by the preview API. Keep those values from
  // turning a same-origin smoke-test request into an attacker-controlled URL.
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.trim() !== path ||
    /[\p{C}\p{Zl}\p{Zp}]/u.test(path)
  ) {
    throw new TypeError(
      "Preview API path must be root-relative and contain no surrounding whitespace, control characters, or line separators",
    );
  }
  const requestURL = new URL(path, apiURL);
  if (requestURL.origin !== apiURL.origin) {
    throw new TypeError(`Preview API URL must stay on ${apiURL.origin}`);
  }
  return requestURL;
}
