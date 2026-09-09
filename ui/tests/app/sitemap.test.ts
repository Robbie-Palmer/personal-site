import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";

describe("sitemap", () => {
  it("includes the ideas index and every idea detail page", () => {
    const ideaUrls = sitemap()
      .map((entry) => entry.url)
      .filter((url) => url.includes("/ideas"));

    expect(ideaUrls).toContain("https://robbiepalmer.me/ideas");
    expect(ideaUrls).toContain("https://robbiepalmer.me/ideas/goodharts-law");
    expect(ideaUrls).toHaveLength(10);
  });
});
