import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import posthog from "posthog-js";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShareButtons } from "@/components/blog/share-buttons";

vi.mock("posthog-js", () => ({
  default: { capture: vi.fn() },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const post = {
  slug: "just-right-engineering",
  title: "Just Right Engineering",
  url: "https://robbiepalmer.me/blog/just-right-engineering",
};

function renderShareButtons() {
  render(<ShareButtons {...post} />);
}

function mockClipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
}

describe("ShareButtons", () => {
  beforeEach(() => {
    vi.mocked(posthog.capture).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("links to X with the post url and title", () => {
    renderShareButtons();

    expect(screen.getByLabelText("Share on X")).toHaveAttribute(
      "href",
      "https://x.com/intent/tweet?url=https%3A%2F%2Frobbiepalmer.me%2Fblog%2Fjust-right-engineering&text=Just+Right+Engineering",
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

  it("renders the copy link button with a non-submit type", () => {
    renderShareButtons();

    expect(screen.getByLabelText("Copy link")).toHaveAttribute(
      "type",
      "button",
    );
  });

  it("copies the post url and shows success feedback when copy link is clicked", async () => {
    mockClipboard(vi.fn().mockResolvedValue(undefined));
    renderShareButtons();

    fireEvent.click(screen.getByLabelText("Copy link"));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(post.url);
      expect(toast.success).toHaveBeenCalledWith("Link copied");
    });
    expect(screen.getByLabelText("Copy link")).toHaveTextContent("Copied");
  });

  it("shows an error toast and keeps the share label when copying fails", async () => {
    mockClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    renderShareButtons();

    fireEvent.click(screen.getByLabelText("Copy link"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Could not copy link");
    });
    expect(screen.getByLabelText("Copy link")).toHaveTextContent("Share");
  });
});
