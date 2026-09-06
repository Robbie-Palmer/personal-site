import { afterEach, describe, expect, it, vi } from "vitest";
import { requiredEnv } from "../src/env";

describe("requiredEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads from the Node.js process environment by default", () => {
    vi.stubEnv("NODE_BASE_ENV_TEST", "from-process");

    expect(requiredEnv("NODE_BASE_ENV_TEST")).toBe("from-process");
  });

  it("returns a present environment variable", () => {
    expect(requiredEnv("API_TOKEN", { API_TOKEN: "secret" })).toBe("secret");
  });

  it.each([{}, { API_TOKEN: "" }])(
    "rejects a missing or empty environment variable",
    (environment) => {
      expect(() => requiredEnv("API_TOKEN", environment)).toThrow(
        "Missing required environment variable: API_TOKEN",
      );
    },
  );
});
