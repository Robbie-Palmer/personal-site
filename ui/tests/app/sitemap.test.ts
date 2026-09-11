import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";

describe("sitemap", () => {
  it("includes the satellite swarm project space", () => {
    expect(sitemap().map((entry) => entry.url)).toContain(
      "https://robbiepalmer.me/satellite-swarm",
    );
  });

  it("includes the ideas index and every idea detail page", () => {
    const ideaUrls = sitemap()
      .map((entry) => entry.url)
      .filter((url) => url.includes("/ideas"));

    expect(ideaUrls).toContain("https://robbiepalmer.me/ideas");
    expect(ideaUrls).toContain("https://robbiepalmer.me/ideas/goodharts-law");
    expect(ideaUrls).toContain(
      "https://robbiepalmer.me/ideas/flp-impossibility",
    );
    expect(ideaUrls).toContain(
      "https://robbiepalmer.me/ideas/human-in-the-loop",
    );
    expect(ideaUrls).toContain(
      "https://robbiepalmer.me/ideas/human-on-the-loop",
    );
    expect(ideaUrls).toContain(
      "https://robbiepalmer.me/ideas/stream-table-duality",
    );
    expect(ideaUrls).toContain(
      "https://robbiepalmer.me/ideas/context-engineering",
    );
    expect(ideaUrls).toContain("https://robbiepalmer.me/ideas/commit-log");
    expect(ideaUrls).toHaveLength(27);
  });
});
