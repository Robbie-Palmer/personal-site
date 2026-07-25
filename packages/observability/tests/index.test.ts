import { describe, expect, it } from "vitest";
import {
  traceCarrierFromHeaders,
  traceIdentityFromHeaders,
} from "../src";

describe("traceIdentityFromHeaders", () => {
  it("reads PostHog person and session correlation headers", () => {
    const headers = new Headers({
      "x-posthog-distinct-id": "person-123",
      "x-posthog-session-id": "session-456",
    });

    expect(traceIdentityFromHeaders(headers)).toEqual({
      posthogDistinctId: "person-123",
      sessionId: "session-456",
    });
  });

  it("omits missing correlation values", () => {
    expect(traceIdentityFromHeaders(new Headers())).toEqual({
      posthogDistinctId: undefined,
      sessionId: undefined,
    });
  });
});

describe("traceCarrierFromHeaders", () => {
  it("copies W3C trace context for explicit propagation", () => {
    const headers = new Headers({
      traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
      tracestate: "vendor=value",
    });

    expect(traceCarrierFromHeaders(headers)).toEqual({
      traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
      tracestate: "vendor=value",
    });
  });

  it("omits an absent trace context", () => {
    expect(traceCarrierFromHeaders(new Headers())).toBeUndefined();
  });
});
