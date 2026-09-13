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
  type LayerSlotPolicy,
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

type ProjectOverride = { technology: TechnologySlug; decision: ADRRef };

function getProjectOverrides(
  repository: DomainRepository,
  projectSlug: ProjectSlug,
  instant: string,
): Map<DefaultSlotSlug, ProjectOverride> {
  const overrides = new Map<DefaultSlotSlug, ProjectOverride>();
  for (const [adrRef, override] of repository.platform.adrOverrides) {
    const adr = repository.adrs.get(adrRef);
    if (
      adr?.projectSlug === projectSlug &&
      adr.status === "Accepted" &&
      isUseEffectiveAt(override, instant)
    ) {
      overrides.set(override.slot, {
        technology: override.technology,
        decision: adrRef,
      });
    }
  }
  return overrides;
}

interface ResolutionState {
  manifest: PlatformManifest;
  instant: string;
  effectiveUses: ProjectLayerUse[];
  layers: Set<LayerSlug>;
  overrides: ReadonlyMap<DefaultSlotSlug, ProjectOverride>;
  resolvedSlots: Map<DefaultSlotSlug, TechnologySlug>;
  technologies: EffectiveTechnologyUse[];
}

function hasPreferredSlotUse(
  policy: LayerSlotPolicy,
  effectiveUses: ProjectLayerUse[],
  instant: string,
): boolean {
  return effectiveUses
    .flatMap((use) => use.slots)
    .some((use) => use.slot === policy.slot && isUseEffectiveAt(use, instant));
}

function technologySource(
  policy: LayerSlotPolicy,
  override: ProjectOverride | undefined,
): EffectiveTechnologySource {
  if (override) return "override";
  return policy.mode === "required" ? "required-layer" : "preferred-layer";
}

function resolvePolicy(
  policy: LayerSlotPolicy,
  state: ResolutionState,
): EffectiveTechnologyUse | undefined {
  if (!state.layers.has(policy.layer) || !isEffectiveAt(policy, state.instant))
    return undefined;
  if (
    policy.mode === "preferred" &&
    !hasPreferredSlotUse(policy, state.effectiveUses, state.instant)
  )
    return undefined;
  if (!prerequisitesMet(policy.prerequisites, state.resolvedSlots))
    return undefined;
  if (state.resolvedSlots.has(policy.slot)) return undefined;

  const override = state.overrides.get(policy.slot);
  const selection = currentSelection(
    state.manifest,
    policy.slot,
    state.instant,
  );
  const technology = override?.technology ?? selection?.technology;
  if (!technology) return undefined;
  return {
    technology,
    source: technologySource(policy, override),
    layer: policy.layer,
    slot: policy.slot,
    policy: policy.id,
    selection: override ? undefined : selection?.id,
    decision: override?.decision ?? selection?.decision,
  };
}

function activateDependentLayers(
  policy: LayerSlotPolicy,
  technology: TechnologySlug,
  state: ResolutionState,
): void {
  for (const layer of state.manifest.layers) {
    if (
      layer.activatedBy?.slot === policy.slot &&
      layer.activatedBy.technology === technology
    ) {
      state.layers.add(layer.slug);
    }
  }
}

function applyResolutionPass(state: ResolutionState): boolean {
  let resolvedAny = false;
  for (const policy of state.manifest.policies) {
    const technologyUse = resolvePolicy(policy, state);
    if (!technologyUse) continue;
    state.resolvedSlots.set(policy.slot, technologyUse.technology);
    state.technologies.push(technologyUse);
    activateDependentLayers(policy, technologyUse.technology, state);
    resolvedAny = true;
  }
  return resolvedAny;
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

  const overrides = getProjectOverrides(repository, projectSlug, instant);
  const resolvedSlots = new Map<DefaultSlotSlug, TechnologySlug>();
  const state: ResolutionState = {
    manifest,
    instant,
    effectiveUses,
    layers,
    overrides,
    resolvedSlots,
    technologies,
  };
  while (applyResolutionPass(state)) {
    // Resolve prerequisite chains until a pass adds no technologies.
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

interface UpgradeContext {
  repository: DomainRepository;
  layer: LayerSlug;
  replacement: DefaultSelection;
  previous: DefaultSelection;
  at: string;
  priorInstant: string;
}

function shouldRecommendUpgrade(
  context: UpgradeContext,
  project: ProjectSlug,
  uses: ProjectLayerUse[],
): boolean {
  const { repository, layer, replacement, previous, at, priorInstant } =
    context;
  const entity = repository.projects.get(project);
  if (!entity || entity.status === "completed") return false;
  if (repository.graph.edges.createdAtRole.has(project)) return false;
  if (!uses.some((use) => use.tracking && isUseEffectiveAt(use, at)))
    return false;
  const stack = resolveEffectiveProjectStack(repository, project, priorInstant);
  if (!stack.layers.includes(layer)) return false;
  const usesPrevious = stack.technologies.some(
    (use) => use.slot === replacement.slot && use.selection === previous.id,
  );
  if (!usesPrevious) return false;
  const hasOverride = Array.from(repository.platform.adrOverrides).some(
    ([adrRef, value]) =>
      repository.adrs.get(adrRef)?.projectSlug === project &&
      value.slot === replacement.slot &&
      isUseEffectiveAt(value, at),
  );
  return !hasOverride;
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
  const context: UpgradeContext = {
    repository,
    layer: policy.layer,
    replacement,
    previous,
    at,
    priorInstant,
  };
  for (const [project, uses] of repository.platform.projectLayerUses) {
    if (!shouldRecommendUpgrade(context, project, uses)) continue;
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
