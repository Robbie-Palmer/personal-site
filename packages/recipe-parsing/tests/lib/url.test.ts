import { describe, expect, it } from "vitest";
import { httpUrl } from "../../src/lib/url.js";

describe("httpUrl", () => {
  it("normalizes HTTP and HTTPS URLs", () => {
    expect(httpUrl("https://example.com/recipe")).toBe(
      "https://example.com/recipe",
    );
    expect(httpUrl("http://example.com")).toBe("http://example.com/");
  });

  it("rejects other protocols and malformed values", () => {
    expect(httpUrl("ftp://example.com/recipe")).toBeUndefined();
    expect(httpUrl("not a URL")).toBeUndefined();
    expect(httpUrl(null)).toBeUndefined();
  });
});
