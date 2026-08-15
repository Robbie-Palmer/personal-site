import { describe, expect, it } from "vitest";
import {
  previewApiOriginSchema,
  previewApiRequestURL,
} from "../scripts/preview-api-url";

const apiURL = previewApiOriginSchema.parse("https://preview-api.example.test");

describe("previewApiOriginSchema", () => {
  it("accepts an HTTPS origin with or without its trailing slash", () => {
    expect(
      previewApiOriginSchema.parse("https://preview-api.example.test").href,
    ).toBe("https://preview-api.example.test/");
    expect(
      previewApiOriginSchema.parse("https://preview-api.example.test/").href,
    ).toBe("https://preview-api.example.test/");
  });

  it.each([
    "preview-api.example.test",
    "https:preview-api.example.test",
    "https:/preview-api.example.test",
    "http://preview-api.example.test",
    "https://user:secret@preview-api.example.test",
    "https://preview-api.example.test/base/",
    "https://preview-api.example.test/?environment=preview",
    "https://preview-api.example.test/#preview",
  ])("rejects a value that is not an HTTPS origin: %s", (value) => {
    expect(() => previewApiOriginSchema.parse(value)).toThrow(
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
    "households/safe-id/members",
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
