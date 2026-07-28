import posthog from "posthog-js";

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

function setIdentityHeader(
  headers: Headers,
  name: string,
  identity: () => string,
): void {
  try {
    const value = identity();
    if (value) headers.set(name, value);
  } catch {
    // Correlation is best-effort and must never break the application request.
  }
}

if (posthogKey) {
  posthog.init(posthogKey, {
    api_host: "/ingest",
    ui_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    defaults: "2025-11-30",
    // Enables capturing unhandled exceptions via Error Tracking
    capture_exceptions: true,
    // Turn on debug in development mode
    debug: process.env.NODE_ENV === "development",
  });

  // Attach PostHog identity to same-origin API requests so backend OTLP logs
  // can link directly to the person and session replay that produced them.
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = new URL(
      input instanceof Request ? input.url : input.toString(),
      window.location.origin,
    );
    if (
      requestUrl.origin !== window.location.origin ||
      !requestUrl.pathname.startsWith("/api/")
    ) {
      return originalFetch(input, init);
    }

    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    setIdentityHeader(headers, "x-posthog-distinct-id", () =>
      posthog.get_distinct_id(),
    );
    setIdentityHeader(headers, "x-posthog-session-id", () =>
      posthog.get_session_id(),
    );

    return originalFetch(input, { ...init, headers });
  };
}
