import { describe, expect, it } from "vitest";
import { getAllInitiatives, getInitiative } from "@/lib/api/initiatives";
import { getAllADRs, getAllProjects, getProject } from "@/lib/api/projects";
import { siteConfig } from "@/lib/config/site-config";
import { createFeedDocuments } from "@/scripts/generate-rss";

function itemLinks(xml: string): string[] {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  return Array.from(document.querySelectorAll("item > link"), (link) =>
    link.textContent?.trim(),
  ).filter((link): link is string => Boolean(link));
}

describe("RSS generation", () => {
  const documents = new Map(
    createFeedDocuments().map((document) => [
      document.relativePath,
      document.content,
    ]),
  );

  it("creates a feed for every project and initiative", () => {
    for (const project of getAllProjects()) {
      expect(documents.has(`projects/${project.slug}/feed.xml`)).toBe(true);
    }
    for (const initiative of getAllInitiatives()) {
      expect(documents.has(`initiatives/${initiative.slug}/feed.xml`)).toBe(
        true,
      );
    }
  });

  it("limits a project feed to the project and its own ADRs", () => {
    const project = getProject("personal-site");
    const links = itemLinks(
      documents.get("projects/personal-site/feed.xml") ?? "",
    );
    const expected = [
      `${siteConfig.url}/projects/personal-site`,
      ...getAllADRs()
        .filter((adr) => adr.projectSlug === project.slug && !adr.isInherited)
        .map(
          (adr) =>
            `${siteConfig.url}/projects/${project.slug}/adrs/${adr.slug}`,
        ),
    ];

    const allowedLinks = new Set(expected);
    expect(links).toHaveLength(50);
    expect(links).toContain(`${siteConfig.url}/projects/personal-site`);
    expect(links.every((link) => allowedLinks.has(link))).toBe(true);
    expect(links).not.toContain(`${siteConfig.url}/projects/recipe-site`);
  });

  it("includes an initiative, its projects, and those projects' ADRs", () => {
    const initiative = getInitiative("personalized-medicine");
    if (!initiative) throw new Error("Expected initiative to exist");
    const projectSlugs = new Set(
      initiative.projects.map((project) => project.slug),
    );
    const links = itemLinks(
      documents.get("initiatives/personalized-medicine/feed.xml") ?? "",
    );

    expect(links).toContain(
      `${siteConfig.url}/initiatives/personalized-medicine`,
    );
    for (const projectSlug of projectSlugs) {
      expect(links).toContain(`${siteConfig.url}/projects/${projectSlug}`);
    }
    for (const adr of getAllADRs().filter(
      (candidate) =>
        projectSlugs.has(candidate.projectSlug) && !candidate.isInherited,
    )) {
      expect(links).toContain(
        `${siteConfig.url}/projects/${adr.projectSlug}/adrs/${adr.slug}`,
      );
    }
    expect(links).not.toContain(`${siteConfig.url}/projects/homelab`);
  });
});
