import { render, screen } from "@testing-library/react";
import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProjectDeckPresenterPage, {
  generateMetadata,
  generateStaticParams,
} from "@/app/(deck)/projects/[slug]/deck/presenter/page";
import type { ProjectWithADRs } from "@/lib/api/projects";
import { getAllProjects, getProject } from "@/lib/api/projects";

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("not found");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: notFoundMock }));

vi.mock("@/lib/api/projects", () => ({
  getAllProjects: vi.fn(),
  getProject: vi.fn(),
}));

vi.mock("@/components/projects/pitch-deck/pitch-deck-presenter", () => ({
  PitchDeckPresenter: ({
    deckHref,
    title,
  }: {
    deckHref: string;
    title: string;
  }) => <div>{`${title}: ${deckHref}`}</div>,
}));

const projectWithPitch = {
  slug: "agentic-code-review",
  title: "Agentic Code Review",
  description: "Project description",
  date: "2026-08-31",
  status: "in_progress",
  content: "# Overview",
  technologies: [],
  adrSlugs: [],
  adrs: [],
  tags: [],
  pitch: {
    title: "Agentic Code Review pitch",
    description: "Pitch description",
    content: "# Opening slide",
  },
} as ProjectWithADRs;

describe("project deck presenter page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates presenter routes only for projects with decks", () => {
    (getAllProjects as Mock).mockReturnValue([
      projectWithPitch,
      { ...projectWithPitch, slug: "without-pitch", pitch: undefined },
    ]);

    expect(generateStaticParams()).toEqual([{ slug: "agentic-code-review" }]);
  });

  it("uses noindex presenter metadata", async () => {
    (getProject as Mock).mockReturnValue(projectWithPitch);

    await expect(
      generateMetadata({
        params: Promise.resolve({ slug: "agentic-code-review" }),
      }),
    ).resolves.toEqual({
      title: "Agentic Code Review pitch presenter",
      robots: { index: false, follow: false },
    });
  });

  it("renders the presenter for the project deck", async () => {
    (getProject as Mock).mockReturnValue(projectWithPitch);

    render(
      await ProjectDeckPresenterPage({
        params: Promise.resolve({ slug: "agentic-code-review" }),
      }),
    );

    expect(
      screen.getByText(
        "Agentic Code Review pitch: /projects/agentic-code-review/deck",
      ),
    ).toBeInTheDocument();
  });

  it("returns not found for a missing project or pitch", async () => {
    (getProject as Mock).mockImplementationOnce(() => {
      throw new Error("missing");
    });
    await expect(
      ProjectDeckPresenterPage({
        params: Promise.resolve({ slug: "missing" }),
      }),
    ).rejects.toThrow("not found");

    (getProject as Mock).mockReturnValue({
      ...projectWithPitch,
      pitch: undefined,
    });
    await expect(
      ProjectDeckPresenterPage({
        params: Promise.resolve({ slug: "without-pitch" }),
      }),
    ).rejects.toThrow("not found");
    expect(notFoundMock).toHaveBeenCalledTimes(2);
  });
});
