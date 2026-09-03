import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InitiativeOverview } from "@/components/projects/initiative-overview";
import {
  InitiativeProjectNavigation,
  ProjectInitiativeContext,
} from "@/components/projects/project-initiative-context";
import type { InitiativeWithProjects } from "@/lib/api/initiatives";

function initiativeFixture(): InitiativeWithProjects {
  return {
    slug: "personalized-medicine",
    title: "Personalized Medicine",
    description: "Make patient-specific decisions more accessible.",
    content: "## Goal",
    projectContributions: {
      second: "Connected pathology and genomic evidence.",
    },
    projects: [
      { slug: "first", title: "First project", date: "2022-01-01" },
      { slug: "second", title: "Second project", date: "2023-01-01" },
      { slug: "third", title: "Third project", date: "2024-01-01" },
      { slug: "fourth", title: "Fourth project", date: "2025-01-01" },
      { slug: "fifth", title: "Fifth project", date: "2026-01-01" },
    ],
  } as unknown as InitiativeWithProjects;
}

describe("initiative project navigation", () => {
  it("summarizes initiatives and their immediate projects", () => {
    render(<InitiativeOverview initiatives={[initiativeFixture()]} />);

    expect(
      screen.getByRole("heading", { name: "Initiatives" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View Personalized Medicine" }),
    ).toHaveAttribute("href", "/initiatives/personalized-medicine");
    expect(
      screen.getByRole("link", { name: "Second project" }),
    ).toHaveAttribute("href", "/projects/second");
    expect(screen.getByText("+1 more project")).toBeInTheDocument();
    expect(screen.queryByText("Read about the initiative")).toBeNull();
  });

  it("renders nothing when there are no initiatives", () => {
    const { container } = render(<InitiativeOverview initiatives={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("explains how a project contributes to its parent initiative", () => {
    render(
      <ProjectInitiativeContext
        initiatives={[initiativeFixture()]}
        projectSlug="second"
      />,
    );

    expect(screen.getByText("Contributes to")).toBeInTheDocument();
    expect(
      screen.getByText("Connected pathology and genomic evidence."),
    ).toBeInTheDocument();
  });

  it("falls back to the initiative description without relationship prose", () => {
    render(
      <ProjectInitiativeContext
        initiatives={[initiativeFixture()]}
        projectSlug="first"
      />,
    );

    expect(
      screen.getByText("Make patient-specific decisions more accessible."),
    ).toBeInTheDocument();
  });

  it("links to the previous and next project within one initiative", () => {
    render(
      <InitiativeProjectNavigation
        initiatives={[initiativeFixture()]}
        projectSlug="second"
      />,
    );

    expect(screen.getByRole("link", { name: /First project/ })).toHaveAttribute(
      "href",
      "/projects/first",
    );
    expect(screen.getByRole("link", { name: /Third project/ })).toHaveAttribute(
      "href",
      "/projects/third",
    );
    expect(screen.getByText("Project 2 of 5")).toBeInTheDocument();
  });

  it("avoids implying one sequence when a project has multiple parents", () => {
    const fixture = initiativeFixture();
    const { container } = render(
      <InitiativeProjectNavigation
        initiatives={[fixture, { ...fixture, slug: "another" }]}
        projectSlug="second"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
