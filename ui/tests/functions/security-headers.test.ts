import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const headersFile = fs.readFileSync(
  path.resolve(process.cwd(), "public/_headers"),
  "utf8",
);

function header(name: string): string | undefined {
  return headersFile
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith(`${name}:`))
    ?.slice(name.length + 1)
    .trim();
}

describe("Cloudflare Pages security headers", () => {
  it("applies baseline browser protections to every static response", () => {
    expect(headersFile.trimStart().startsWith("/*")).toBe(true);
    expect(header("X-Frame-Options")).toBe("DENY");
    expect(header("X-Content-Type-Options")).toBe("nosniff");
    expect(header("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(header("Strict-Transport-Security")).toBe(
      "max-age=31536000; includeSubDomains; preload",
    );
    expect(header("Permissions-Policy")).toContain("camera=()");
  });

  it("blocks framing and limits active content to required origins", () => {
    const policy = header("Content-Security-Policy");
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain(
      "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
    );
    expect(policy).toContain("https://imagedelivery.net");
    expect(policy).toContain("https://avatars.githubusercontent.com");
    expect(policy).toContain("https://*.googleusercontent.com");
  });
});
