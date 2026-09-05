import { render, screen } from "@testing-library/react";
import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProjectDeckPage, {
  generateMetadata,
  generateStaticParams,
} from "@/app/(deck)/projects/[slug]/deck/page";
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

vi.mock("@/components/projects/pitch-deck/focused-pitch-deck", () => ({
  FocusedPitchDeck: ({
    children,
    title,
  }: {
    children: React.ReactNode;
    title: string;
  }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

vi.mock("@/components/projects/pitch-deck/pitch-deck-content", () => ({
  PitchDeckContent: ({ source }: { source: string }) => <div>{source}</div>,
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

describe("focused project deck page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates routes only for projects with decks", () => {
    (getAllProjects as Mock).mockReturnValue([
      projectWithPitch,
      { ...projectWithPitch, slug: "without-pitch", pitch: undefined },
    ]);

    expect(generateStaticParams()).toEqual([{ slug: "agentic-code-review" }]);
  });

  it("uses pitch metadata and falls back when no deck is available", async () => {
    (getProject as Mock)
      .mockReturnValueOnce(projectWithPitch)
      .mockReturnValueOnce({
        ...projectWithPitch,
        pitch: undefined,
      });

    await expect(
      generateMetadata({
        params: Promise.resolve({ slug: "agentic-code-review" }),
      }),
    ).resolves.toEqual({
      title: "Agentic Code Review pitch",
      description: "Pitch description",
    });
    await expect(
      generateMetadata({ params: Promise.resolve({ slug: "without-pitch" }) }),
    ).resolves.toEqual({ title: "Pitch deck not found" });

    (getProject as Mock).mockImplementation(() => {
      throw new Error("missing");
    });
    await expect(
      generateMetadata({ params: Promise.resolve({ slug: "missing" }) }),
    ).resolves.toEqual({ title: "Pitch deck not found" });
  });

  it("renders the shared deck source in focused mode", async () => {
    (getProject as Mock).mockReturnValue(projectWithPitch);

    render(
      await ProjectDeckPage({
        params: Promise.resolve({ slug: "agentic-code-review" }),
      }),
    );

    expect(
      screen.getByRole("heading", { name: "Agentic Code Review pitch" }),
    ).toBeInTheDocument();
    expect(screen.getByText("# Opening slide")).toBeInTheDocument();
  });

  it("returns not found for a missing project or pitch", async () => {
    (getProject as Mock).mockImplementationOnce(() => {
      throw new Error("missing");
    });
    await expect(
      ProjectDeckPage({ params: Promise.resolve({ slug: "missing" }) }),
    ).rejects.toThrow("not found");

    (getProject as Mock).mockReturnValue({
      ...projectWithPitch,
      pitch: undefined,
    });
    await expect(
      ProjectDeckPage({ params: Promise.resolve({ slug: "without-pitch" }) }),
    ).rejects.toThrow("not found");
    expect(notFoundMock).toHaveBeenCalledTimes(2);
  });
});
