import { describe, expect, it } from "vitest";
import { getADRsForProject } from "@/lib/domain/adr/adrQueries";
import {
  type DefaultSelection,
  getSelectionLifecycleStatus,
  getUpgradeRecommendations,
  isUseEffectiveAt,
  PlatformManifestSchema,
  ProjectLayerUseSchema,
  resolveEffectiveProjectStack,
  UtcInstantSchema,
} from "@/lib/domain/platform";
import { loadDomainRepository } from "@/lib/repository";

function sameDayManifest(linkReplacement = true) {
  return {
    project: "platform",
    layers: [{ slug: "base", title: "Base", description: "Shared defaults" }],
    slots: [
      {
        slug: "tool.runner",
        title: "Task runner",
        description: "Runs project tasks",
        rationale: "Several task runners address the same requirement",
        opinionated: true,
      },
    ],
    policies: [
      {
        id: "tool-runner-policy",
        layer: "base",
        slot: "tool.runner",
        mode: "required",
        effectiveFrom: "2026-09-12T09:00:00Z",
        decision: "platform:000-runner",
        prerequisites: [],
      },
    ],
    selections: [
      {
        id: "runner-old",
        slot: "tool.runner",
        technology: "old-runner",
        status: "Accepted",
        effectiveFrom: "2026-09-12T09:00:00Z",
        effectiveUntil: "2026-09-12T12:00:00Z",
        decision: "platform:000-runner",
        originProjects: [],
      },
      {
        id: "runner-new",
        slot: "tool.runner",
        technology: "new-runner",
        status: "Accepted",
        effectiveFrom: "2026-09-12T12:00:00Z",
        decision: "platform:001-new-runner",
        originProjects: [],
        ...(linkReplacement ? { supersedes: "runner-old" } : {}),
      },
    ],
  };
}

describe("temporal platform layers", () => {
  it("accepts half-open replacements on the same day and derives superseded status", () => {
    const result = PlatformManifestSchema.safeParse(sameDayManifest());
    expect(result.success).toBe(true);
    if (!result.success) return;
    const firstSelection = result.data.selections[0];
    expect(firstSelection).toBeDefined();
    if (!firstSelection) return;
    expect(getSelectionLifecycleStatus(result.data, firstSelection)).toBe(
      "Superseded",
    );
  });

  it("rejects unlinked accepted replacements", () => {
    const result = PlatformManifestSchema.safeParse(sameDayManifest(false));
    expect(result.success).toBe(false);
    expect(
      result.error?.issues.some((issue) =>
        issue.message.includes("must supersede"),
      ),
    ).toBe(true);
  });

  it("rejects date-only temporal values", () => {
    expect(
      ProjectLayerUseSchema.safeParse({
        layer: "base",
        adopted: "2026-09-12",
        tracking: true,
      }).success,
    ).toBe(false);
  });

  it("validates calendar dates and compares fractional UTC instants", () => {
    expect(UtcInstantSchema.safeParse("2026-02-30T00:00:00Z").success).toBe(
      false,
    );
    expect(
      ProjectLayerUseSchema.safeParse({
        layer: "base",
        adopted: "2026-09-12T12:00:00Z",
        until: "2026-09-12T12:00:00.500Z",
        tracking: false,
      }).success,
    ).toBe(true);
    expect(
      isUseEffectiveAt(
        { adopted: "2026-09-12T12:00:00Z" },
        "2026-09-12T12:00:00.250Z",
      ),
    ).toBe(true);
  });

  it("resolves required, preferred, and overridden technologies", () => {
    const repository = loadDomainRepository();
    const manifest = repository.platform.manifest;
    expect(
      manifest?.layers.find((layer) => layer.slug === "python")?.activatedBy,
    ).toEqual({ slot: "project.primary-language", technology: "python" });
    expect(
      manifest?.selections.some(
        (selection) =>
          selection.slot === "project.primary-language" &&
          selection.technology === "python",
      ),
    ).toBe(false);

    const recipe = resolveEffectiveProjectStack(
      repository,
      "recipe-site",
      "2026-09-12T12:00:00Z",
    );
    expect(recipe.layers).toEqual(
      expect.arrayContaining(["base", "typescript", "database"]),
    );
    expect(recipe.technologies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          technology: "zod",
          source: "required-layer",
        }),
        expect.objectContaining({
          technology: "postgresql",
          source: "preferred-layer",
        }),
        expect.objectContaining({
          technology: "neon",
          source: "preferred-layer",
        }),
        expect.objectContaining({
          technology: "cloudflare-workers",
          source: "preferred-layer",
        }),
      ]),
    );
    expect(recipe.technologies.map((use) => use.technology)).not.toContain(
      "duckdb",
    );

    const python = resolveEffectiveProjectStack(
      repository,
      "agent-first-writing",
      "2026-09-12T12:00:00Z",
    );
    expect(python.layers).toContain("python");
    expect(python.layers).not.toContain("typescript");
    expect(python.technologies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ technology: "python", source: "override" }),
        expect.objectContaining({
          technology: "pydantic",
          source: "required-layer",
        }),
        expect.objectContaining({
          technology: "pytest-cases",
          source: "required-layer",
        }),
      ]),
    );
  });

  it("keeps inherited ADR aliases out of local project histories", () => {
    const repository = loadDomainRepository();
    const recipeADRs = getADRsForProject(repository, "recipe-site");
    expect(
      recipeADRs.some((adr) => adr.slug === "000-github-public-repo"),
    ).toBe(false);
    expect(
      repository.adrAliases.get("recipe-site:000-github-public-repo"),
    ).toBe("personal-site:000-github-public-repo");
  });

  it("freezes a closed project before a later platform replacement", () => {
    const repository = loadDomainRepository();
    const manifest = repository.platform.manifest;
    expect(manifest).toBeDefined();
    if (!manifest) return;
    const oldPrimary = manifest.selections.find(
      (selection) =>
        selection.id === "project-primary-language-typescript-2026-09-12",
    );
    expect(oldPrimary).toBeDefined();
    if (!oldPrimary) return;
    const frozenRepository = {
      ...repository,
      platform: {
        ...repository.platform,
        manifest: {
          ...manifest,
          selections: [
            ...manifest.selections.filter(
              (selection) => selection !== oldPrimary,
            ),
            { ...oldPrimary, effectiveUntil: "2026-10-01T00:00:00Z" },
            {
              ...oldPrimary,
              id: "project-primary-language-python-2026-10-01",
              technology: "python",
              effectiveFrom: "2026-10-01T00:00:00Z",
              supersedes: oldPrimary.id,
            },
          ],
        },
        projectLayerUses: new Map([
          [
            "personal-site",
            [
              {
                layer: "base",
                adopted: "2026-09-12T00:00:00Z",
                until: "2026-09-20T00:00:00Z",
                tracking: false,
                slots: [],
              },
            ],
          ],
        ]),
      },
    };
    const stack = resolveEffectiveProjectStack(
      frozenRepository,
      "personal-site",
      "2026-10-02T00:00:00Z",
    );
    expect(stack.at).toBe("2026-09-19T23:59:59.999Z");
    expect(stack.layers).toContain("typescript");
    expect(stack.layers).not.toContain("python");
  });

  it("recommends a simulated supersession only to tracking personal projects", () => {
    const repository = loadDomainRepository();
    const manifest = repository.platform.manifest;
    expect(manifest).toBeDefined();
    if (!manifest) return;
    const previousId = "typescript-schema-validation-zod-2026-09-12";
    const replacement: DefaultSelection = {
      id: "typescript-schema-validation-valibot-2026-10-01",
      slot: "typescript.schema-validation",
      technology: "valibot",
      status: "Accepted",
      effectiveFrom: "2026-10-01T00:00:00Z",
      decision: "personal-engineering-platform:001-language-defaults",
      originProjects: [],
      supersedes: previousId,
    };
    const repositoryAfterReplacement = {
      ...repository,
      platform: {
        ...repository.platform,
        manifest: {
          ...manifest,
          selections: [
            ...manifest.selections
              .filter((selection) => selection.id !== previousId)
              .map((selection) => ({ ...selection })),
            {
              ...manifest.selections.find(
                (selection) => selection.id === previousId,
              )!,
              effectiveUntil: replacement.effectiveFrom,
            },
            replacement,
          ],
        },
      },
    };
    const recommendations = getUpgradeRecommendations(
      repositoryAfterReplacement,
      replacement,
    );
    const projects = recommendations.map(
      (recommendation) => recommendation.project,
    );
    expect(projects).toContain("personal-site");
    expect(projects).toContain("recipe-site");
    expect(projects).not.toContain("agent-first-writing");
    expect(projects).not.toContain("genomic-prediction");
  });

  it("does not recommend a preferred-slot change to a project that never activated the slot", () => {
    const repository = loadDomainRepository();
    const manifest = repository.platform.manifest;
    expect(manifest).toBeDefined();
    if (!manifest) return;
    const previousId = "backend-api-runtime-cloudflare-workers-2026-09-12";
    const replacement: DefaultSelection = {
      id: "backend-api-runtime-next-2026-10-01",
      slot: "backend-api.runtime",
      technology: "nextdotjs",
      status: "Accepted",
      effectiveFrom: "2026-10-01T00:00:00Z",
      decision: "personal-engineering-platform:002-cloudflare-workers",
      originProjects: [],
      supersedes: previousId,
    };
    const previous = manifest.selections.find(
      (selection) => selection.id === previousId,
    );
    expect(previous).toBeDefined();
    if (!previous) return;
    const projectLayerUses = new Map(repository.platform.projectLayerUses);
    projectLayerUses.set("agent-first-writing", [
      ...(projectLayerUses.get("agent-first-writing") ?? []),
      {
        layer: "backend-api",
        adopted: "2026-09-12T00:00:00Z",
        tracking: true,
        slots: [],
      },
    ]);
    const repositoryAfterReplacement = {
      ...repository,
      platform: {
        ...repository.platform,
        manifest: {
          ...manifest,
          selections: [
            ...manifest.selections.filter(
              (selection) => selection.id !== previousId,
            ),
            { ...previous, effectiveUntil: replacement.effectiveFrom },
            replacement,
          ],
        },
        projectLayerUses,
      },
    };

    const projects = getUpgradeRecommendations(
      repositoryAfterReplacement,
      replacement,
    ).map((recommendation) => recommendation.project);

    expect(projects).not.toContain("agent-first-writing");
    expect(projects).toContain("recipe-site");
  });
});
