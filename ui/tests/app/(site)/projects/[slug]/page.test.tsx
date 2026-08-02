import { render, screen } from "@testing-library/react";
import type { Mock } from "vitest";
import { describe, expect, it, vi } from "vitest";
import ProjectPage from "@/app/(site)/projects/[slug]/page";
import type { ProjectWithADRs } from "@/lib/api/projects";
import { getProject } from "@/lib/api/projects";

vi.mock("@/lib/api/projects", () => ({
  getAllProjectSlugs: () => ["homelab"],
  getProject: vi.fn(),
}));

vi.mock("@/components/projects/project-tabs", () => ({
  ProjectTabs: ({
    overview,
    adrs,
  }: {
    overview: React.ReactNode;
    adrs: React.ReactNode;
  }) => (
    <div>
      <div data-testid="overview">{overview}</div>
      <div data-testid="adrs">{adrs}</div>
    </div>
  ),
}));

vi.mock("@/components/markdown", () => ({
  Markdown: ({ source }: { source: string }) => <div>{source}</div>,
}));

vi.mock("@/components/mermaid", () => ({
  Mermaid: () => <div>mermaid</div>,
}));

vi.mock("@/components/projects/adr-list", () => ({
  ADRList: () => <div>adr-list</div>,
}));

const fixture = {
  slug: "homelab",
  title: "Home Lab",
  description: "Test description",
  date: "2026-08-02",
  status: "live",
  content: "# Home Lab\n\nHello",
  technologies: [
    {
      name: "Tailscale",
      slug: "tailscale",
      iconSlug: "tailscale",
      hasIcon: true,
      website: "https://tailscale.com",
    },
  ],
  adrSlugs: ["000-tailscale"],
  adrs: [
    {
      adrRef: "ADR-000",
      slug: "000-tailscale",
      title: "Tailscale",
      date: "2026-08-02",
      status: "Accepted",
      readingTime: "1 min",
      projectSlug: "homelab",
      originProjectSlug: "homelab",
      originAdrSlug: "000-tailscale",
      isInherited: false,
      technologies: [],
    },
  ],
  tags: [],
} as ProjectWithADRs;

describe("project page", () => {
  it("renders the project with the content component registry", async () => {
    (getProject as Mock).mockReturnValue(fixture);

    render(await ProjectPage({ params: Promise.resolve({ slug: "homelab" }) }));

    expect(
      screen.getByRole("heading", { name: "Home Lab" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Test description")).toBeInTheDocument();
    expect(screen.getByText("adr-list")).toBeInTheDocument();
  });
});
