import { describe, expect, it } from "vitest";
import { traceIdentityFromHeaders } from "../src";

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
