import type { DomainRepository } from "@/lib/repository";
import { makeNodeId } from "@/lib/repository/graph";
import type { ADRRef } from "../adr/adr";
import type { ProjectSlug } from "../project/project";
import type { TechnologySlug } from "../technology/technology";
import {
  compareUtcInstants,
  type DefaultSelection,
  type DefaultSlotSlug,
  isEffectiveAt,
  isUseEffectiveAt,
  type LayerSlug,
  type PlatformManifest,
  type ProjectLayerUse,
} from "./platform";

export type EffectiveTechnologySource =
  | "project-specific"
  | "required-layer"
  | "preferred-layer"
  | "override";

export interface EffectiveTechnologyUse {
  technology: TechnologySlug;
  source: EffectiveTechnologySource;
  layer?: LayerSlug;
  slot?: DefaultSlotSlug;
  policy?: string;
  selection?: string;
  decision?: ADRRef;
}

export interface EffectiveProjectStack {
  project: ProjectSlug;
  at: string;
  layers: LayerSlug[];
  technologies: EffectiveTechnologyUse[];
}

function resolutionInstant(
  projectUses: ProjectLayerUse[],
  requested: string,
): string {
  if (projectUses.some((use) => use.tracking)) return requested;
  const closedAt = projectUses
    .filter((use) => !use.tracking && use.until)
    .map((use) => use.until as string)
    .toSorted(compareUtcInstants)
    .at(-1);
  if (!closedAt || compareUtcInstants(requested, closedAt) < 0)
    return requested;
  return new Date(Date.parse(closedAt) - 1).toISOString();
}

function currentSelection(
  manifest: PlatformManifest,
  slot: DefaultSlotSlug,
  instant: string,
): DefaultSelection | undefined {
  return manifest.selections.find(
    (selection) =>
      selection.slot === slot &&
      selection.status === "Accepted" &&
      isEffectiveAt(selection, instant),
  );
}

function prerequisitesMet(
  prerequisites: { slot: DefaultSlotSlug; technology?: TechnologySlug }[],
  resolvedSlots: ReadonlyMap<DefaultSlotSlug, TechnologySlug>,
): boolean {
  return prerequisites.every((prerequisite) => {
    const selected = resolvedSlots.get(prerequisite.slot);
    return (
      selected !== undefined &&
      (prerequisite.technology === undefined ||
        selected === prerequisite.technology)
    );
  });
}

export function resolveEffectiveProjectStack(
  repository: DomainRepository,
  projectSlug: ProjectSlug,
  requestedInstant = new Date().toISOString(),
): EffectiveProjectStack {
  const direct = repository.graph.edges.usesTechnology.get(
    makeNodeId("project", projectSlug),
  );
  const projectUses =
    repository.platform.projectLayerUses.get(projectSlug) ?? [];
  const instant = resolutionInstant(projectUses, requestedInstant);
  const technologies: EffectiveTechnologyUse[] = Array.from(direct ?? []).map(
    (technology) => ({ technology, source: "project-specific" }),
  );
  const manifest = repository.platform.manifest;
  if (!manifest) {
    return { project: projectSlug, at: instant, layers: [], technologies };
  }

  const layers = new Set<LayerSlug>();
  const effectiveUses = projectUses.filter((use) =>
    isUseEffectiveAt(use, instant),
  );
  for (const use of effectiveUses) {
    layers.add(use.layer);
  }

  const overrides = new Map<
    DefaultSlotSlug,
    { technology: TechnologySlug; decision: ADRRef }
  >();
  for (const [adrRef, override] of repository.platform.adrOverrides) {
    if (
      repository.adrs.get(adrRef)?.projectSlug === projectSlug &&
      repository.adrs.get(adrRef)?.status === "Accepted" &&
      isUseEffectiveAt(override, instant)
    ) {
      overrides.set(override.slot, {
        technology: override.technology,
        decision: adrRef,
      });
    }
  }

  const resolvedSlots = new Map<DefaultSlotSlug, TechnologySlug>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const policy of manifest.policies) {
      if (!layers.has(policy.layer) || !isEffectiveAt(policy, instant))
        continue;
      const preferredUse = effectiveUses
        .flatMap((use) => use.slots)
        .find(
          (use) => use.slot === policy.slot && isUseEffectiveAt(use, instant),
        );
      if (policy.mode === "preferred" && !preferredUse) continue;
      if (!prerequisitesMet(policy.prerequisites, resolvedSlots)) continue;
      if (resolvedSlots.has(policy.slot)) continue;

      const override = overrides.get(policy.slot);
      const selection = currentSelection(manifest, policy.slot, instant);
      const technology = override?.technology ?? selection?.technology;
      if (!technology) continue;
      resolvedSlots.set(policy.slot, technology);
      changed = true;
      const source = override
        ? "override"
        : policy.mode === "required"
          ? "required-layer"
          : "preferred-layer";
      technologies.push({
        technology,
        source,
        layer: policy.layer,
        slot: policy.slot,
        policy: policy.id,
        selection: override ? undefined : selection?.id,
        decision: override?.decision ?? selection?.decision,
      });
      for (const layer of manifest.layers) {
        if (
          layer.activatedBy?.slot === policy.slot &&
          layer.activatedBy.technology === technology &&
          !layers.has(layer.slug)
        ) {
          layers.add(layer.slug);
          changed = true;
        }
      }
    }
  }

  return {
    project: projectSlug,
    at: instant,
    layers: Array.from(layers),
    technologies,
  };
}

export interface UpgradeRecommendation {
  project: ProjectSlug;
  layer: LayerSlug;
  slot: DefaultSlotSlug;
  from: DefaultSelection;
  to: DefaultSelection;
  decidingADRs: ADRRef[];
}

export function getUpgradeRecommendations(
  repository: DomainRepository,
  replacement: DefaultSelection,
  at = replacement.effectiveFrom,
): UpgradeRecommendation[] {
  if (!replacement.supersedes) return [];
  const manifest = repository.platform.manifest;
  const previous = manifest?.selections.find(
    (selection) => selection.id === replacement.supersedes,
  );
  if (!manifest || !previous) return [];
  const policy = manifest.policies.find(
    (candidate) =>
      candidate.slot === replacement.slot && isEffectiveAt(candidate, at),
  );
  if (!policy) return [];

  const recommendations: UpgradeRecommendation[] = [];
  const priorInstant = new Date(
    Date.parse(replacement.effectiveFrom) - 1,
  ).toISOString();
  for (const [project, uses] of repository.platform.projectLayerUses) {
    const entity = repository.projects.get(project);
    if (!entity || entity.status === "completed") continue;
    if (repository.graph.edges.createdAtRole.has(project)) continue;
    if (!uses.some((use) => use.tracking && isUseEffectiveAt(use, at)))
      continue;
    const stack = resolveEffectiveProjectStack(
      repository,
      project,
      priorInstant,
    );
    if (!stack.layers.includes(policy.layer)) continue;
    if (
      !stack.technologies.some(
        (use) => use.slot === replacement.slot && use.selection === previous.id,
      )
    )
      continue;
    const override = Array.from(repository.platform.adrOverrides).some(
      ([adrRef, value]) =>
        repository.adrs.get(adrRef)?.projectSlug === project &&
        value.slot === replacement.slot &&
        isUseEffectiveAt(value, at),
    );
    if (override) continue;
    recommendations.push({
      project,
      layer: policy.layer,
      slot: replacement.slot,
      from: previous,
      to: replacement,
      decidingADRs: [previous.decision, replacement.decision],
    });
  }
  return recommendations;
}
