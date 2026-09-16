import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PostHogApplicationPage, { metadata } from "@/app/(site)/posthog/page";

vi.mock("@/app/(site)/posthog/posthog.module.css", () => ({
  default: {
    artefactCard: "artefactCard",
    artefactImage: "artefactImage",
    evidenceCard: "evidenceCard",
    heroTeaser: "heroTeaser",
    heroTeaserItem: "heroTeaserItem",
    hoggie: "hoggie",
    loopStage: "loopStage",
    page: "page",
    paperPanel: "paperPanel",
    scribble: "scribble",
    terminalPanel: "terminalPanel",
    thread: "thread",
    weirdQuote: "weirdQuote",
  },
}));

vi.mock("next/font/local", () => ({
  default: () => ({ variable: "roundhog-variable" }),
}));

describe("PostHog application page", () => {
  it("addresses PostHog with inspectable evidence", () => {
    render(<PostHogApplicationPage />);

    expect(screen.getByText("Dear")).toBeVisible();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "I want to help products drive themselves.",
      }),
    ).toBeVisible();
    expect(
      screen.getByText(
        /a record of whether each change was merged and deployed/i,
      ),
    ).toBeVisible();
    expect(
      screen.getByText(/before I knew PostHog used that phrase/i),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: "The work is public. You can inspect it.",
      }),
    ).toBeVisible();
    expect(screen.getByText(/used it to pick up this page/i)).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: "The subjects jump. The obsession does not.",
      }),
    ).toBeVisible();
    expect(screen.getByText(/Correct\. That is the point/i)).toBeVisible();
    expect(screen.getByText(/DeskHog is a developer toy/i)).toBeVisible();
    expect(
      screen.getByRole("link", {
        name: /A preview of the weirdness.*See the through-line/i,
      }),
    ).toHaveAttribute("href", "#specific-weirdness");
    expect(
      screen.getByRole("link", { name: /^Satellite swarm$/i }),
    ).toHaveAttribute("href", "/projects/autonomic-satellite-swarm");
    expect(
      screen.getByRole("img", {
        name: /whole-slide pathology viewer showing/i,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("img", {
        name: /site's knowledge graph with hundreds/i,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("img", {
        name: /Terminal Industries computer vision identifying a truck/i,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: /A yard that sees what is moving/i }),
    ).toHaveAttribute(
      "href",
      "/projects/real-time-multi-camera-video-analytics",
    );
    expect(
      screen.getByText(/Public product footage · Terminal Industries/i),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: /Inspect the Work Graph/i }),
    ).toHaveAttribute("href", "/projects/work-graph");
    expect(
      screen.getByRole("link", { name: /Try the product demo/i }),
    ).toHaveAttribute("href", "/recipes");
    expect(
      screen.getByRole("link", { name: /Resume and experience/i }),
    ).toHaveAttribute("href", "/experience");
  });

  it("publishes canonical and Markdown alternates", () => {
    expect(metadata.alternates).toEqual({
      canonical: "/posthog",
      types: { "text/markdown": "/posthog.md" },
    });
  });
});
