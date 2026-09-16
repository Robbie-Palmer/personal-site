import { describe, expect, it } from "vitest";
import { GET } from "@/app/posthog.md/route";

describe("PostHog application Markdown route", () => {
  it("serves the Markdown twin with work weirdness before personal weirdness", async () => {
    const response = GET();
    const markdown = await response.text();

    expect(response.headers.get("content-type")).toBe(
      "text/markdown; charset=utf-8",
    );
    expect(markdown).toContain("# I want to help products drive themselves");
    expect(markdown.indexOf("### What the weirdness looks like")).toBeLessThan(
      markdown.indexOf("### Outside the repository"),
    );
  });
});
