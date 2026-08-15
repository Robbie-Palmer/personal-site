import { describe, expect, it } from "vitest";
import { previewApiRequestURL } from "../scripts/preview-api-url";

const apiURL = new URL("https://preview-api.example.test");

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
    " //attacker.example.test/collect",
    "\n//attacker.example.test/collect",
    "/\t/attacker.example.test/collect",
    "/\0/attacker.example.test/collect",
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
