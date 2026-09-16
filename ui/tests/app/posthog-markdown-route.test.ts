import { describe, expect, it } from "vitest";
import { GET } from "@/app/posthog.md/route";

describe("PostHog application Markdown route", () => {
  it("serves the Markdown twin in the same narrative order", async () => {
    const response = GET();
    const markdown = await response.text();

    expect(response.headers.get("content-type")).toBe(
      "text/markdown; charset=utf-8",
    );
    expect(markdown).toContain("# I want to help products drive themselves");
    expect(
      markdown.indexOf(
        "## I was already building the machine around the coding agent.",
      ),
    ).toBeLessThan(markdown.indexOf("## What the weirdness looks like"));
    expect(markdown.indexOf("## What the weirdness looks like")).toBeLessThan(
      markdown.indexOf("## The subjects jump. The obsession does not."),
    );
    expect(
      markdown.indexOf("## The subjects jump. The obsession does not."),
    ).toBeLessThan(markdown.indexOf("### Outside the repository"));
    expect(markdown.indexOf("### Outside the repository")).toBeLessThan(
      markdown.indexOf(
        "## The culture I keep trying to build already exists here.",
      ),
    );
    expect(markdown).not.toContain("## The loop");
  });
});
