import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlatformManifest } from "@/components/projects/platform-manifest";
import { PlatformSummary } from "@/components/projects/platform-summary";
import { getProjectWithADRs } from "@/lib/domain/project/projectQueries";
import { loadDomainRepository } from "@/lib/repository";

describe("project platform components", () => {
  it("renders the platform's layers, defaults, users, and overrides", () => {
    const repository = loadDomainRepository();
    const project = getProjectWithADRs(
      repository,
      "personal-engineering-platform",
    );
    expect(project?.platformManifest).toBeDefined();
    if (!project?.platformManifest) return;

    render(<PlatformManifest manifest={project.platformManifest} />);

    expect(
      screen.getByRole("heading", { name: "Current layer manifest" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Default history" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Backend API" })).toBeVisible();
    expect(screen.getAllByText("preferred").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Users:/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "decision" })).toHaveLength(
      project.platformManifest.slots.flatMap((slot) => slot.selections).length,
    );
  });

  it("renders adopted layers and expandable platform technologies", () => {
    const project = getProjectWithADRs(loadDomainRepository(), "recipe-site");
    expect(project).not.toBeNull();
    if (!project) return;

    const { container } = render(
      <PlatformSummary
        builtOn={project.builtOn}
        platformTechnologies={project.platformTechnologies}
      />,
    );

    expect(screen.getByLabelText("Platform")).toHaveTextContent("Built on");
    expect(screen.getByText(/platform technologies/)).toBeVisible();
    expect(container.querySelectorAll("a").length).toBeGreaterThan(1);
  });

  it("does not present a future policy as current", () => {
    const project = getProjectWithADRs(
      loadDomainRepository(),
      "personal-engineering-platform",
    );
    expect(project?.platformManifest).toBeDefined();
    if (!project?.platformManifest) return;
    const layer = project.platformManifest.layers[0];
    const policy = project.platformManifest.policies[0];
    expect(layer).toBeDefined();
    expect(policy).toBeDefined();
    if (!layer || !policy) return;

    render(
      <PlatformManifest
        manifest={{
          layers: [layer],
          policies: [
            {
              ...policy,
              layer: layer.slug,
              effectiveFrom: "2099-01-01T00:00:00Z",
            },
          ],
          slots: [],
        }}
      />,
    );

    expect(screen.queryByText(policy.mode)).not.toBeInTheDocument();
  });

  it("omits the summary when no platform layer is adopted", () => {
    const { container } = render(<PlatformSummary />);
    expect(container).toBeEmptyDOMElement();
  });
});
