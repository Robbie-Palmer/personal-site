import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProjectsPage from "@/app/(site)/projects/page";

vi.mock("@/lib/api/initiatives", () => ({
  getAllInitiatives: () => [
    {
      slug: "personalized-medicine",
      title: "Personalized Medicine",
      description: "Make patient-specific decisions more accessible.",
      content: "",
      projectContributions: {},
      projects: [],
    },
  ],
}));

vi.mock("@/lib/api/projects", () => ({
  getAllProjects: () => [],
  getBuildingPhilosophy: () => "## Building Philosophy",
}));

vi.mock("@/components/projects/projects-page-tabs", () => ({
  ProjectsPageTabs: ({
    projects,
    philosophy,
  }: {
    projects: React.ReactNode;
    philosophy: React.ReactNode;
  }) => (
    <div>
      {projects}
      {philosophy}
    </div>
  ),
}));

vi.mock("@/components/projects/project-list", () => ({
  ProjectList: () => <div>Complete project list</div>,
}));

vi.mock("@/components/markdown", () => ({
  Markdown: ({ source }: { source: string }) => <div>{source}</div>,
}));

describe("projects page", () => {
  it("places initiatives before the complete project list", async () => {
    render(await ProjectsPage());

    const initiative = screen.getByRole("link", {
      name: "View Personalized Medicine",
    });
    const allProjects = screen.getByRole("heading", { name: "All projects" });

    expect(
      initiative.compareDocumentPosition(allProjects) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText("Complete project list")).toBeInTheDocument();
  });
});
