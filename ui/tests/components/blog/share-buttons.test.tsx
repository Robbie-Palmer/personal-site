import { fireEvent, render, screen } from "@testing-library/react";
import posthog from "posthog-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShareButtons } from "@/components/blog/share-buttons";

vi.mock("posthog-js", () => ({
  default: { capture: vi.fn() },
}));

const post = {
  slug: "just-right-engineering",
  title: "Just Right Engineering",
  url: "https://robbiepalmer.me/blog/just-right-engineering",
};

function renderShareButtons() {
  render(<ShareButtons {...post} />);
}

describe("ShareButtons", () => {
  beforeEach(() => {
    vi.mocked(posthog.capture).mockReset();
  });

  it("links to X with the post url and title", () => {
    renderShareButtons();

    expect(screen.getByLabelText("Share on X")).toHaveAttribute(
      "href",
      "https://x.com/intent/post?url=https%3A%2F%2Frobbiepalmer.me%2Fblog%2Fjust-right-engineering&text=Just+Right+Engineering",
    );
  });

  it("links to LinkedIn with the post url", () => {
    renderShareButtons();

    expect(screen.getByLabelText("Share on LinkedIn")).toHaveAttribute(
      "href",
      "https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Frobbiepalmer.me%2Fblog%2Fjust-right-engineering",
    );
  });

  it("links to Hacker News with the post url and title", () => {
    renderShareButtons();

    expect(screen.getByLabelText("Share on Hacker News")).toHaveAttribute(
      "href",
      "https://news.ycombinator.com/submitlink?u=https%3A%2F%2Frobbiepalmer.me%2Fblog%2Fjust-right-engineering&t=Just+Right+Engineering",
    );
  });

  it("opens share targets in a new tab without leaking the referrer opener", () => {
    renderShareButtons();

    for (const label of [
      "Share on X",
      "Share on LinkedIn",
      "Share on Hacker News",
    ]) {
      const link = screen.getByLabelText(label);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  it.each([
    ["Share on X", "x"],
    ["Share on LinkedIn", "linkedin"],
    ["Share on Hacker News", "hackernews"],
  ])("captures a share event when %s is clicked", (label, platform) => {
    renderShareButtons();

    // fireEvent, not userEvent: userEvent's hover opens the Radix tooltip
    // (delayDuration 0), and the resulting re-render can swallow the click.
    fireEvent.click(screen.getByLabelText(label));

    expect(posthog.capture).toHaveBeenCalledWith("blog_post_shared", {
      platform,
      slug: post.slug,
      url: post.url,
    });
  });
});
