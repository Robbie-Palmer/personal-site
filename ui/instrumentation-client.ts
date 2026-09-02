import posthog, { type CaptureResult } from "posthog-js";

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

// Browsers raise these as window ErrorEvents when a ResizeObserver callback
// changes the layout it just measured. The browser recovers on the next frame,
// so they are noise that would otherwise sit in error tracking next to real
// faults with no stack to act on.
const BROWSER_NOISE_MESSAGES = [
  "ResizeObserver loop completed with undelivered notifications",
  "ResizeObserver loop limit exceeded",
];

function isBrowserNoise(event: CaptureResult): boolean {
  if (event.event !== "$exception") return false;
  const exceptions: unknown = event.properties?.$exception_list;
  if (!Array.isArray(exceptions)) return false;
  return exceptions.some(({ value }: { value?: unknown }) =>
    BROWSER_NOISE_MESSAGES.some(
      (message) => typeof value === "string" && value.startsWith(message),
    ),
  );
}

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
    before_send: (event) => (event && isBrowserNoise(event) ? null : event),
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
