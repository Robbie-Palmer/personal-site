import { render, screen, within } from "@testing-library/react";
import type { Mock } from "vitest";
import { describe, expect, it, vi } from "vitest";
import InitiativePage, {
  generateMetadata,
  generateStaticParams,
} from "@/app/(site)/initiatives/[slug]/page";
import { getInitiative } from "@/lib/api/initiatives";

vi.mock("@/lib/api/initiatives", () => ({
  getAllInitiativeSlugs: () => ["personalized-medicine"],
  getInitiative: vi.fn(),
}));

vi.mock("@/components/markdown", () => ({
  Markdown: ({ source }: { source: string }) => <div>{source}</div>,
}));

const fixture = {
  slug: "personalized-medicine",
  title: "Personalized Medicine",
  description: "Make patient-specific decisions more accessible.",
  content:
    "## Goal\n\nMake care more personal.\n\n## Scope\n\nPathology and genomics.",
  projectContributions: {},
  projects: [
    {
      slug: "pathology-viewer",
      title: "Pathology Viewer",
      description: "Inspect whole-slide images.",
      contribution: "Made model outputs inspectable.",
      date: "2022-01-01",
      status: "completed",
      tags: ["computational pathology"],
      technologies: [],
      adrSlugs: [],
      adrs: [{}],
    },
  ],
};

describe("initiative page", () => {
  it("generates routes and metadata", async () => {
    (getInitiative as Mock).mockReturnValue(fixture);

    expect(generateStaticParams()).toEqual([{ slug: "personalized-medicine" }]);
    await expect(
      generateMetadata({
        params: Promise.resolve({ slug: "personalized-medicine" }),
      }),
    ).resolves.toEqual({
      title: "Personalized Medicine - Initiative",
      description: "Make patient-specific decisions more accessible.",
    });
  });

  it("renders the initiative and its immediate projects", async () => {
    (getInitiative as Mock).mockReturnValue(fixture);

    render(
      await InitiativePage({
        params: Promise.resolve({ slug: "personalized-medicine" }),
      }),
    );

    expect(
      screen.getByRole("heading", { name: "Personalized Medicine", level: 1 }),
    ).toBeInTheDocument();
    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(breadcrumb).getAllByRole("link")).toHaveLength(1);
    expect(
      within(breadcrumb).getByRole("link", { name: "Projects" }),
    ).toHaveAttribute("href", "/projects");
    expect(
      screen.getByText("Made model outputs inspectable."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Goal", level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Scope", level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View Pathology Viewer" }),
    ).toHaveAttribute("href", "/projects/pathology-viewer");
    expect(
      screen.getAllByRole("link", { name: /Pathology Viewer/ }),
    ).toHaveLength(1);
    expect(screen.queryByText("Read the project")).toBeNull();
    expect(screen.getByText("computational pathology")).toBeInTheDocument();
    expect(screen.getByText("1 decision")).toBeInTheDocument();
  });

  it("renders unheaded initiative prose as an about section", async () => {
    (getInitiative as Mock).mockReturnValue({
      ...fixture,
      content: "A plain-language initiative brief.",
      projects: [],
    });

    render(
      await InitiativePage({
        params: Promise.resolve({ slug: "personalized-medicine" }),
      }),
    );

    expect(
      screen.getByRole("heading", { name: "About", level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("A plain-language initiative brief."),
    ).toBeInTheDocument();
  });

  it("supports a section heading without body copy", async () => {
    (getInitiative as Mock).mockReturnValue({
      ...fixture,
      content: "## Goal",
      projects: [],
    });

    render(
      await InitiativePage({
        params: Promise.resolve({ slug: "personalized-medicine" }),
      }),
    );

    expect(
      screen.getByRole("heading", { name: "Goal", level: 2 }),
    ).toBeInTheDocument();
  });

  it("renders the not-found boundary for an unknown initiative", async () => {
    (getInitiative as Mock).mockImplementation(() => {
      throw new Error("Initiative not found: missing");
    });

    await expect(
      InitiativePage({ params: Promise.resolve({ slug: "missing" }) }),
    ).rejects.toThrow();
  });

  it("uses not-found metadata for an unknown initiative", async () => {
    (getInitiative as Mock).mockImplementation(() => {
      throw new Error("Initiative not found: missing");
    });

    await expect(
      generateMetadata({ params: Promise.resolve({ slug: "missing" }) }),
    ).resolves.toEqual({ title: "Initiative Not Found" });
  });

  it("does not disguise unexpected metadata failures as missing content", async () => {
    (getInitiative as Mock).mockImplementation(() => {
      throw new Error("Repository unavailable");
    });

    await expect(
      generateMetadata({ params: Promise.resolve({ slug: "known" }) }),
    ).rejects.toThrow("Repository unavailable");
  });
});
