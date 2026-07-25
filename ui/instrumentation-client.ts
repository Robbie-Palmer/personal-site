import posthog from "posthog-js";

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

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
    const distinctId = posthog.get_distinct_id();
    const sessionId = posthog.get_session_id();
    if (distinctId) headers.set("x-posthog-distinct-id", distinctId);
    if (sessionId) headers.set("x-posthog-session-id", sessionId);

    return originalFetch(input, { ...init, headers });
  };
}
