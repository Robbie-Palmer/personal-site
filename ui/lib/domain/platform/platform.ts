import { z } from "zod";
import {
  ADRRefSchema,
  ProjectSlugSchema,
  TechnologySlugSchema,
} from "../slugs";

const UTC_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

export const UtcInstantSchema = z
  .string()
  .regex(UTC_INSTANT_PATTERN, "Expected an RFC 3339 UTC instant")
  .refine(isValidUtcInstant, "Invalid UTC instant");

export type UtcInstant = z.infer<typeof UtcInstantSchema>;

export const LayerSlugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const DefaultSlotSlugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+(?:-[a-z0-9]+)*$/);

export type LayerSlug = z.infer<typeof LayerSlugSchema>;
export type DefaultSlotSlug = z.infer<typeof DefaultSlotSlugSchema>;

const TemporalPeriodSchema = z
  .object({
    effectiveFrom: UtcInstantSchema,
    effectiveUntil: UtcInstantSchema.optional(),
  })
  .refine(
    ({ effectiveFrom, effectiveUntil }) =>
      effectiveUntil === undefined ||
      compareUtcInstants(effectiveFrom, effectiveUntil) < 0,
    { message: "effective_until must be later than effective_from" },
  );

export const PlatformLayerActivationSchema = z.object({
  slot: DefaultSlotSlugSchema,
  technology: TechnologySlugSchema,
});

export const PlatformLayerSchema = z.object({
  slug: LayerSlugSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  activatedBy: PlatformLayerActivationSchema.optional(),
});

export const DefaultSlotSchema = z
  .object({
    slug: DefaultSlotSlugSchema,
    title: z.string().min(1),
    description: z.string().min(1),
    rationale: z.string().min(1),
    opinionated: z.boolean().default(true),
    effectiveFrom: UtcInstantSchema.optional(),
    effectiveUntil: UtcInstantSchema.optional(),
    noDefaultFrom: UtcInstantSchema.optional(),
  })
  .refine(
    ({ effectiveFrom, effectiveUntil }) =>
      effectiveUntil === undefined ||
      (effectiveFrom !== undefined &&
        compareUtcInstants(effectiveFrom, effectiveUntil) < 0),
    { message: "A slot lifecycle end requires an earlier lifecycle start" },
  );

export const SlotPrerequisiteSchema = z.object({
  slot: DefaultSlotSlugSchema,
  technology: TechnologySlugSchema.optional(),
});

export const LayerSlotPolicySchema = TemporalPeriodSchema.extend({
  id: z.string().min(1),
  layer: LayerSlugSchema,
  slot: DefaultSlotSlugSchema,
  mode: z.enum(["required", "preferred"]),
  decision: ADRRefSchema,
  prerequisites: z.array(SlotPrerequisiteSchema).default([]),
});

export const DefaultSelectionSchema = TemporalPeriodSchema.extend({
  id: z.string().min(1),
  slot: DefaultSlotSlugSchema,
  technology: TechnologySlugSchema,
  status: z.enum(["Proposed", "Accepted", "Rejected", "Deprecated"]),
  decision: ADRRefSchema,
  originProjects: z.array(ProjectSlugSchema).default([]),
  supersedes: z.string().min(1).optional(),
});

const PlatformManifestFieldsSchema = z.object({
  project: ProjectSlugSchema,
  layers: z.array(PlatformLayerSchema).min(1),
  slots: z.array(DefaultSlotSchema).min(1),
  policies: z.array(LayerSlotPolicySchema).min(1),
  selections: z.array(DefaultSelectionSchema).min(1),
});

type PlatformManifestInput = z.infer<typeof PlatformManifestFieldsSchema>;

function addManifestIssue(context: z.RefinementCtx, message: string): void {
  context.addIssue({ code: "custom", message });
}

function validatePolicyReferences(
  manifest: PlatformManifestInput,
  layerSlugs: ReadonlySet<string>,
  slots: ReadonlyMap<string, unknown>,
  context: z.RefinementCtx,
): void {
  for (const policy of manifest.policies) {
    if (!layerSlugs.has(policy.layer) || !slots.has(policy.slot)) {
      addManifestIssue(
        context,
        `Slot policy '${policy.id}' references an unknown layer or slot`,
      );
    }
    for (const prerequisite of policy.prerequisites) {
      if (!slots.has(prerequisite.slot)) {
        addManifestIssue(
          context,
          `Slot policy '${policy.id}' references unknown prerequisite '${prerequisite.slot}'`,
        );
      }
      const hasSelection = manifest.selections.some(
        (selection) =>
          selection.slot === prerequisite.slot &&
          selection.technology === prerequisite.technology,
      );
      if (prerequisite.technology && !hasSelection) {
        addManifestIssue(
          context,
          `Slot policy '${policy.id}' references a technology not selected by prerequisite '${prerequisite.slot}'`,
        );
      }
    }
  }
}

function validateLayerReferences(
  manifest: PlatformManifestInput,
  slots: ReadonlyMap<string, unknown>,
  context: z.RefinementCtx,
): void {
  for (const layer of manifest.layers) {
    if (layer.activatedBy && !slots.has(layer.activatedBy.slot)) {
      addManifestIssue(
        context,
        `Layer '${layer.slug}' is activated by unknown slot '${layer.activatedBy.slot}'`,
      );
    }
  }
}

function validateSelectionReferences(
  manifest: PlatformManifestInput,
  slots: ReadonlyMap<string, unknown>,
  selections: ReadonlyMap<string, PlatformManifestInput["selections"][number]>,
  context: z.RefinementCtx,
): void {
  for (const selection of manifest.selections) {
    if (!slots.has(selection.slot)) {
      addManifestIssue(
        context,
        `Selection '${selection.id}' references unknown slot '${selection.slot}'`,
      );
    }
    if (!selection.supersedes) continue;
    const previous = selections.get(selection.supersedes);
    if (previous?.slot !== selection.slot) {
      addManifestIssue(
        context,
        `Selection '${selection.id}' supersedes a missing selection or one from another slot`,
      );
    } else if (previous.effectiveUntil !== selection.effectiveFrom) {
      addManifestIssue(
        context,
        `Selection '${selection.id}' must start at the superseded selection's exclusive boundary`,
      );
    }
  }
}

function validateAcceptedSelectionChains(
  manifest: PlatformManifestInput,
  context: z.RefinementCtx,
): void {
  for (const slot of manifest.slots) {
    const accepted = manifest.selections
      .filter(
        (selection) =>
          selection.slot === slot.slug && selection.status === "Accepted",
      )
      .toSorted((left, right) =>
        compareUtcInstants(left.effectiveFrom, right.effectiveFrom),
      );
    for (let index = 1; index < accepted.length; index += 1) {
      const previous = accepted[index - 1];
      const current = accepted[index];
      if (current?.supersedes !== previous?.id) {
        addManifestIssue(
          context,
          `Accepted selection '${current?.id}' must supersede '${previous?.id}'`,
        );
      }
    }
  }
}

function validateCurrentDefaults(
  manifest: PlatformManifestInput,
  slots: ReadonlyMap<string, PlatformManifestInput["slots"][number]>,
  context: z.RefinementCtx,
): void {
  const currentInstant = "9999-12-31T23:59:59Z";
  for (const policy of manifest.policies.filter((candidate) =>
    isEffectiveAt(candidate, currentInstant),
  )) {
    const slot = slots.get(policy.slot);
    if (!slot?.opinionated) continue;
    const currentAccepted = manifest.selections.filter(
      (selection) =>
        selection.slot === policy.slot &&
        selection.status === "Accepted" &&
        isEffectiveAt(selection, currentInstant),
    );
    const explicitEmpty =
      slot.noDefaultFrom !== undefined &&
      compareUtcInstants(slot.noDefaultFrom, currentInstant) <= 0;
    const validCount =
      currentAccepted.length === 1 ||
      (explicitEmpty && currentAccepted.length === 0);
    if (!validCount) {
      addManifestIssue(
        context,
        `Opinionated slot '${policy.slot}' must have exactly one current accepted selection`,
      );
    }
  }
}

function validateSlotNames(
  manifest: PlatformManifestInput,
  context: z.RefinementCtx,
): void {
  for (const slot of manifest.slots) {
    const suffix = slot.slug.split(".").at(-1) ?? "";
    if (suffix === "engine" && slot.slug === "database.engine") {
      addManifestIssue(
        context,
        "Slot 'database.engine' is too broad to compare technologies with different requirements",
      );
    }
    const selectedNames = manifest.selections
      .filter((selection) => selection.slot === slot.slug)
      .map((selection) => selection.technology.replace(/[^a-z0-9]/g, ""));
    if (selectedNames.includes(suffix.replace(/[^a-z0-9]/g, ""))) {
      addManifestIssue(
        context,
        `Slot '${slot.slug}' is named after its selected technology`,
      );
    }
  }
}

function validatePlatformManifest(
  manifest: PlatformManifestInput,
  context: z.RefinementCtx,
): void {
  const layerSlugs = new Set(manifest.layers.map((layer) => layer.slug));
  const slots = new Map(manifest.slots.map((slot) => [slot.slug, slot]));
  const selections = new Map(
    manifest.selections.map((selection) => [selection.id, selection]),
  );

  addDuplicateIssues(manifest.layers, (item) => item.slug, "layers", context);
  addDuplicateIssues(manifest.slots, (item) => item.slug, "slots", context);
  addDuplicateIssues(manifest.policies, (item) => item.id, "policies", context);
  addDuplicateIssues(
    manifest.selections,
    (item) => item.id,
    "selections",
    context,
  );
  validatePolicyReferences(manifest, layerSlugs, slots, context);
  validateLayerReferences(manifest, slots, context);
  validateSelectionReferences(manifest, slots, selections, context);
  validateAcceptedSelectionChains(manifest, context);
  validateNoOverlaps(
    manifest.policies,
    (item) => item.slot,
    "slot policies",
    context,
  );
  validateNoOverlaps(
    manifest.selections.filter((selection) => selection.status === "Accepted"),
    (item) => item.slot,
    "accepted selections",
    context,
  );
  validateCurrentDefaults(manifest, slots, context);
  validateSlotNames(manifest, context);
}

export const PlatformManifestSchema = PlatformManifestFieldsSchema.superRefine(
  validatePlatformManifest,
);

export type PlatformLayer = z.infer<typeof PlatformLayerSchema>;
export type DefaultSlot = z.infer<typeof DefaultSlotSchema>;
export type LayerSlotPolicy = z.infer<typeof LayerSlotPolicySchema>;
export type DefaultSelection = z.infer<typeof DefaultSelectionSchema>;
export type PlatformManifest = z.infer<typeof PlatformManifestSchema>;

export const ProjectSlotUseSchema = z
  .object({
    slot: DefaultSlotSlugSchema,
    adopted: UtcInstantSchema,
    until: UtcInstantSchema.optional(),
  })
  .refine(
    ({ adopted, until }) =>
      until === undefined || compareUtcInstants(adopted, until) < 0,
    { message: "until must be later than adopted" },
  );

export const ProjectLayerUseSchema = z
  .object({
    layer: LayerSlugSchema,
    adopted: UtcInstantSchema,
    until: UtcInstantSchema.optional(),
    tracking: z.boolean(),
    slots: z.array(ProjectSlotUseSchema).default([]),
  })
  .refine(
    ({ adopted, until }) =>
      until === undefined || compareUtcInstants(adopted, until) < 0,
    { message: "until must be later than adopted" },
  )
  .refine(({ tracking, until }) => tracking || until !== undefined, {
    message: "A non-tracking layer use must have an until instant",
  })
  .superRefine((use, context) => {
    for (const slotUse of use.slots) {
      if (compareUtcInstants(slotUse.adopted, use.adopted) < 0) {
        context.addIssue({
          code: "custom",
          message: `Slot '${slotUse.slot}' cannot be adopted before its layer`,
        });
      }
      if (
        use.until &&
        (!slotUse.until || compareUtcInstants(slotUse.until, use.until) > 0)
      ) {
        context.addIssue({
          code: "custom",
          message: `Slot '${slotUse.slot}' must close with or before its layer`,
        });
      }
    }
  });

export function getSelectionLifecycleStatus(
  manifest: PlatformManifest,
  selection: DefaultSelection,
): DefaultSelection["status"] | "Superseded" {
  return manifest.selections.some(
    (candidate) => candidate.supersedes === selection.id,
  )
    ? "Superseded"
    : selection.status;
}

export const DefaultOverrideSchema = z
  .object({
    slot: DefaultSlotSlugSchema,
    technology: TechnologySlugSchema,
    adopted: UtcInstantSchema,
    until: UtcInstantSchema.optional(),
  })
  .refine(
    ({ adopted, until }) =>
      until === undefined || compareUtcInstants(adopted, until) < 0,
    { message: "until must be later than adopted" },
  );

export type ProjectSlotUse = z.infer<typeof ProjectSlotUseSchema>;
export type ProjectLayerUse = z.infer<typeof ProjectLayerUseSchema>;
export type DefaultOverride = z.infer<typeof DefaultOverrideSchema>;

type EffectivePeriod = {
  effectiveFrom: string;
  effectiveUntil?: string;
};

export function isEffectiveAt(
  period: EffectivePeriod,
  instant: string,
): boolean {
  return (
    compareUtcInstants(period.effectiveFrom, instant) <= 0 &&
    (period.effectiveUntil === undefined ||
      compareUtcInstants(instant, period.effectiveUntil) < 0)
  );
}

export function isUseEffectiveAt(
  use: { adopted: string; until?: string },
  instant: string,
): boolean {
  return (
    compareUtcInstants(use.adopted, instant) <= 0 &&
    (use.until === undefined || compareUtcInstants(instant, use.until) < 0)
  );
}

export function compareUtcInstants(left: string, right: string): number {
  return Date.parse(left) - Date.parse(right);
}

function isValidUtcInstant(value: string): boolean {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return false;
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = (datePart ?? "").split("-").map(Number);
  const [hour, minute, second] = (timePart ?? "")
    .slice(0, 8)
    .split(":")
    .map(Number);
  const parsed = new Date(timestamp);
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day &&
    parsed.getUTCHours() === hour &&
    parsed.getUTCMinutes() === minute &&
    parsed.getUTCSeconds() === second
  );
}

function addDuplicateIssues<T>(
  items: T[],
  identity: (item: T) => string,
  field: string,
  context: z.RefinementCtx,
): void {
  const seen = new Set<string>();
  for (const item of items) {
    const id = identity(item);
    if (seen.has(id)) {
      context.addIssue({
        code: "custom",
        message: `Duplicate ${field} id '${id}'`,
      });
    }
    seen.add(id);
  }
}

function validateNoOverlaps<T extends EffectivePeriod>(
  items: T[],
  group: (item: T) => string,
  label: string,
  context: z.RefinementCtx,
): void {
  const grouped = Map.groupBy(items, group);
  for (const [key, records] of grouped) {
    const ordered = records.toSorted((left, right) =>
      compareUtcInstants(left.effectiveFrom, right.effectiveFrom),
    );
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1];
      const current = ordered[index];
      if (
        previous &&
        current &&
        (previous.effectiveUntil === undefined ||
          compareUtcInstants(current.effectiveFrom, previous.effectiveUntil) <
            0)
      ) {
        context.addIssue({
          code: "custom",
          message: `Overlapping ${label} for '${key}'`,
        });
      }
    }
  }
}
