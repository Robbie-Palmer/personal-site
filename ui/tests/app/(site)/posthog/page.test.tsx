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
    personalityCard: "personalityCard",
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
      screen.getByText(/cancer diagnostics, logistics yards/i),
    ).toBeVisible();
    expect(screen.getByText(/Gödel → data mesh/i)).toBeVisible();
    expect(screen.getByText(/Shrek through Marx \(20m\)/i)).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: "The work is public. You can inspect it.",
      }),
    ).toBeVisible();
    expect(screen.getByText(/coordinate the work on this page/i)).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: "The subjects jump. The obsession does not.",
      }),
    ).toBeVisible();
    expect(screen.getByText(/Correct\. That is the point/i)).toBeVisible();
    expect(screen.getByText(/DeskHog is a developer toy/i)).toBeVisible();
    expect(
      screen.getByRole("img", {
        name: /PostHog's turquoise DeskHog developer toy/i,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: "The repository is only the organised part.",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", {
        name: /I connected the philosophy of mathematics/i,
      }),
    ).toHaveAttribute(
      "href",
      "/blog/2022-03-02-the-philosophy-of-data-science",
    );
    expect(screen.getByText("I perform solo jazz dancing.")).toBeVisible();
    expect(
      screen.getByRole("img", {
        name: /Flying Feet Jazz Dance Collective logo/i,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: /I perform solo jazz dancing/i }),
    ).toHaveAttribute(
      "href",
      "https://linktr.ee/flyingfeetjazzdancecollective",
    );
    expect(
      screen.getByText("I watch Marxist analyses of Shrek for fun."),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: /Watch the Shrek analysis/i }),
    ).toHaveAttribute("href", "https://youtu.be/V9NlA628lRw");
    expect(
      screen.getByRole("link", { name: /Watch the Barbie essay/i }),
    ).toHaveAttribute("href", "https://youtu.be/DqIYPCemZ38");
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
      screen.getByRole("img", {
        name: /Home lab topology connecting a phone and router/i,
      }),
    ).toBeVisible();
    expect(screen.getByText("01 · Physical topology")).toBeVisible();
    expect(screen.getByText("02 · Inside the Mac mini")).toBeVisible();
    expect(
      screen.getByRole("img", {
        name: /Mac mini container topology showing DNS/i,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", {
        name: /The home lab that runs my projects/i,
      }),
    ).toHaveAttribute("href", "/projects/homelab");
    expect(
      screen.getByRole("link", { name: /A yard that sees what is moving/i }),
    ).toHaveAttribute(
      "href",
      "/projects/real-time-multi-camera-video-analytics",
    );
    expect(
      screen.getByText(/Public product footage · Terminal Industries/i),
    ).toBeVisible();
    expect(screen.getByText(/Belfast is home/i)).toBeVisible();
    expect(screen.getByText(/cat who would object to the move/i)).toBeVisible();
    expect(
      screen.getByRole("img", {
        name: /Max the PostHog hedgehog holding a heart/i,
      }),
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
