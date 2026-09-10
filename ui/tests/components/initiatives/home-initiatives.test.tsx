import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HomeInitiatives } from "@/components/initiatives/home-initiatives";
import type { InitiativeWithProjects } from "@/lib/api/initiatives";

function initiativeFixture(): InitiativeWithProjects {
  return {
    slug: "personalized-medicine",
    title: "Personalized Medicine",
    description: "Make patient-specific decisions more accessible.",
    date: "2017-07-04",
    updated: "2021-11-01",
    status: "inactive",
    content: "",
    projectContributions: {},
    projects: [
      {
        slug: "pathology-viewer",
        title: "Pathology Viewer",
        description: "Review whole-slide images.",
        date: "2019-01-01",
        updated: "2021-11-01",
        technologies: [
          {
            slug: "react",
            name: "React",
            iconSlug: "react",
            hasIcon: true,
            website: "https://react.dev",
          },
          {
            slug: "typescript",
            name: "TypeScript",
            iconSlug: "typescript",
            hasIcon: true,
            website: "https://www.typescriptlang.org",
          },
        ],
        status: "completed",
        content: "",
        adrSlugs: [],
        adrs: [],
        role: {
          slug: "sonrai-analytics",
          company: "Sonrai Analytics",
          logoPath: "/company-logos/sonrai-analytics.png",
          title: "Principal Software Engineer",
          startDate: "2020-01",
          endDate: "2021-11",
        },
        tags: [],
      },
    ],
  };
}

describe("HomeInitiatives", () => {
  it("presents a compact initiative summary with related company logos", () => {
    const { container } = render(
      <HomeInitiatives initiatives={[initiativeFixture()]} />,
    );

    const heading = screen.getByRole("heading", {
      name: "What I'm building toward",
    });
    expect(heading).toBeInTheDocument();
    expect(heading.closest("section")).toHaveClass("mx-auto", "max-w-5xl");
    expect(container.querySelector("[data-slot='card']")).toBeNull();
    expect(
      screen.getByRole("link", { name: "Personalized Medicine" }),
    ).toHaveAttribute("href", "/initiatives/personalized-medicine");
    expect(
      screen.getByRole("link", { name: "Pathology Viewer" }),
    ).toHaveAttribute("href", "/projects/pathology-viewer");
    expect(
      screen.getByRole("link", { name: "View experience at Sonrai Analytics" }),
    ).toHaveAttribute("href", "/experience#sonrai-analytics");
    expect(
      screen
        .getByRole("img", { name: "Sonrai Analytics logo" })
        .getAttribute("src"),
    ).toContain("sonrai-analytics.png");
    expect(
      screen.queryByRole("link", { name: "View React technology" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("1 project")).toBeInTheDocument();
    expect(screen.getByText("2017 to 2021")).toBeInTheDocument();
    expect(screen.getByText("Project path")).toBeInTheDocument();
    expect(screen.queryByText("Project timeline")).not.toBeInTheDocument();
  });

  it("puts active initiatives before past work", () => {
    const inactive = initiativeFixture();
    const active = {
      ...initiativeFixture(),
      slug: "digital-twins",
      title: "Digital Twins",
      status: "active" as const,
    };

    render(<HomeInitiatives initiatives={[inactive, active]} />);

    expect(
      screen
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent?.trim()),
    ).toEqual(["Digital Twins", "Personalized Medicine"]);
  });

  it("shows each related company once", () => {
    const initiative = initiativeFixture();
    const project = initiative.projects[0];
    if (!project) throw new Error("Expected an initiative project fixture");
    initiative.projects.push({
      ...project,
      slug: "second-sonrai-project",
      title: "Second Sonrai Project",
    });

    render(<HomeInitiatives initiatives={[initiative]} />);

    expect(
      screen.getAllByRole("link", {
        name: "View experience at Sonrai Analytics",
      }),
    ).toHaveLength(1);
  });

  it("samples the beginning, middle, and end of a longer project path", () => {
    const initiative = initiativeFixture();
    const project = initiative.projects[0];
    if (!project) throw new Error("Expected an initiative project fixture");
    initiative.projects = [
      { ...project, slug: "first", title: "First", date: "2017-01-01" },
      { ...project, slug: "second", title: "Second", date: "2018-01-01" },
      { ...project, slug: "middle", title: "Middle", date: "2019-01-01" },
      { ...project, slug: "fourth", title: "Fourth", date: "2020-01-01" },
      { ...project, slug: "last", title: "Last", date: "2021-01-01" },
    ];

    render(<HomeInitiatives initiatives={[initiative]} />);

    expect(screen.getByRole("link", { name: "First" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Middle" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Last" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Second" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Fourth" })).toBeNull();
  });
});
