import { describe, expect, it } from "vitest";
import {
  previewApiBaseURL,
  previewApiRequestURL,
} from "../scripts/preview-api-url";

const apiURL = previewApiBaseURL("https://preview-api.example.test");

describe("previewApiBaseURL", () => {
  it("accepts an HTTPS origin with or without its trailing slash", () => {
    expect(previewApiBaseURL("https://preview-api.example.test").href).toBe(
      "https://preview-api.example.test/",
    );
    expect(previewApiBaseURL("https://preview-api.example.test/").href).toBe(
      "https://preview-api.example.test/",
    );
  });

  it.each([
    "preview-api.example.test",
    "http://preview-api.example.test",
    "https://user:secret@preview-api.example.test",
    "https://preview-api.example.test/base/",
    "https://preview-api.example.test/?environment=preview",
    "https://preview-api.example.test/#preview",
  ])("rejects a value that is not an HTTPS origin: %s", (value) => {
    expect(() => previewApiBaseURL(value)).toThrow(
      "PREVIEW_API_URL must be",
    );
  });
});

describe("previewApiRequestURL", () => {
  it("constructs root-relative URLs on the configured API origin", () => {
    expect(
      previewApiRequestURL(apiURL, "/households/safe-id/members?limit=2").href,
    ).toBe(
      "https://preview-api.example.test/households/safe-id/members?limit=2",
    );
  });

  it.each([
    "/%5C%5Cattacker.example.test/collect",
    "/%2F%2Fattacker.example.test/collect",
    "/%00/collect",
    "/／／attacker.example.test/collect",
    "/раypal.example.test/collect",
  ])("keeps encoded or Unicode path text on the configured origin: %s", (path) => {
    const requestURL = previewApiRequestURL(apiURL, path);

    expect(requestURL.origin).toBe(apiURL.origin);
    expect(requestURL.pathname.startsWith("/")).toBe(true);
  });

  it.each([
    "households/safe-id/members",
    " //attacker.example.test/collect",
    "\n//attacker.example.test/collect",
    "/\t/attacker.example.test/collect",
    "/\0/attacker.example.test/collect",
    "/segment\u2028next",
    "/segment\u2066next",
    "//attacker.example.test/collect",
    "https://attacker.example.test/collect",
  ])("rejects a request path outside the root-relative boundary: %s", (path) => {
    expect(() => previewApiRequestURL(apiURL, path)).toThrow(
      "Preview API path must be root-relative",
    );
  });

  it("rejects URL normalization that changes the request origin", () => {
    expect(() =>
      previewApiRequestURL(apiURL, "/\\attacker.example.test/collect"),
    ).toThrow("Preview API URL must stay on https://preview-api.example.test");
  });
});
