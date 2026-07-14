"use client";

import { Check, RotateCcw } from "lucide-react";
import { useUnitPreference } from "@/hooks/use-unit-preference";
import {
  convertToSystem,
  type MeasurementDimension,
  type MeasurementSystem,
  preferenceForSystem,
  UNIT_LABELS,
  type Unit,
  type UnitPreference,
  type UnitTier,
} from "@/lib/domain/recipe/unit";
import { cn } from "@/lib/generic/styles";
import { PanelHead } from "./panel-head";

const PRESETS: { id: MeasurementSystem; label: string; sub: string }[] = [
  { id: "metric", label: "Metric", sub: "tsp · ml · L · g" },
  { id: "uk", label: "UK", sub: "tsp · ml · pints · g" },
  { id: "us", label: "US", sub: "tsp · cups · oz · lb" },
];

const UNIT_OPTIONS: Record<MeasurementDimension, Unit[]> = {
  weight: ["g", "oz", "lb", "kg"],
  volume: ["tsp", "tbsp", "us_fl_oz", "ml", "us_cup", "uk_pint", "l"],
};

const SHORT_LABELS: Partial<Record<Unit, string>> = {
  us_fl_oz: "fl oz",
  us_cup: "cups",
  uk_pint: "pints",
  l: "litres",
};

const DEFAULT_THRESHOLD: Partial<Record<Unit, number>> = {
  tsp: 15,
  tbsp: 45,
  us_fl_oz: 120,
  ml: 1000,
  us_cup: 1000,
  uk_pint: 2000,
  l: 4000,
  g: 1000,
  oz: 340,
  lb: 2000,
  kg: 4000,
};

const SAMPLE: { name: string; amount: number; unit: Unit }[] = [
  { name: "baking powder", amount: 5, unit: "ml" },
  { name: "olive oil", amount: 30, unit: "ml" },
  { name: "plain flour", amount: 250, unit: "g" },
  { name: "whole milk", amount: 600, unit: "ml" },
  { name: "chicken thighs", amount: 1200, unit: "g" },
  { name: "chicken stock", amount: 1500, unit: "ml" },
];

function shortLabel(unit: Unit): string {
  return SHORT_LABELS[unit] ?? UNIT_LABELS[unit]?.plural ?? unit;
}

function thresholdLabel(
  value: number,
  dimension: MeasurementDimension,
): string {
  if (value >= 1000)
    return `${Number((value / 1000).toFixed(2))}${dimension === "weight" ? "kg" : "L"}`;
  return `${Number(value.toFixed(1))}${dimension === "weight" ? "g" : "ml"}`;
}

function normalizeTiers(tiers: UnitTier[]): UnitTier[] {
  return tiers.map((tier, index) => {
    if (index === tiers.length - 1) return { ...tier, upTo: Infinity };
    const previous = index === 0 ? 0 : (tiers[index - 1]?.upTo ?? 0);
    return { ...tier, upTo: Math.max(previous + 1, tier.upTo) };
  });
}

function Ladder({
  dimension,
  preference,
  onChange,
}: {
  dimension: MeasurementDimension;
  preference: UnitPreference;
  onChange: (preference: UnitPreference) => void;
}) {
  const tiers = preference[dimension];
  const active = new Set(tiers.map((tier) => tier.unit));

  const setTiers = (next: UnitTier[]) =>
    onChange({
      ...preference,
      preset: "custom",
      [dimension]: normalizeTiers(next),
    });

  const toggle = (unit: Unit) => {
    if (active.has(unit)) {
      if (tiers.length === 1) return;
      setTiers(tiers.filter((tier) => tier.unit !== unit));
      return;
    }
    const optionOrder = UNIT_OPTIONS[dimension];
    const next = [
      ...tiers,
      { unit, upTo: DEFAULT_THRESHOLD[unit] ?? 1000 },
    ].sort((a, b) => optionOrder.indexOf(a.unit) - optionOrder.indexOf(b.unit));
    setTiers(next);
  };

  const setThreshold = (index: number, value: number) => {
    const next = tiers.map((tier, tierIndex) =>
      tierIndex === index ? { ...tier, upTo: value } : tier,
    );
    setTiers(next);
  };

  return (
    <section className="rounded-2xl border border-[var(--line-strong)] bg-[var(--card)] p-4 md:p-5">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h3 className="rt-display text-2xl capitalize">{dimension}</h3>
        <span className="rt-mono text-[var(--ink-3)]">
          {tiers.length} {tiers.length === 1 ? "unit" : "units"} in the ladder
        </span>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {UNIT_OPTIONS[dimension].map((unit) => {
          const on = active.has(unit);
          return (
            <button
              key={unit}
              type="button"
              onClick={() => toggle(unit)}
              aria-pressed={on}
              aria-label={`${on ? "Remove" : "Add"} ${shortLabel(unit)}`}
              className={cn(
                "rt-mono rounded-full border px-3 py-1.5 transition-colors",
                on
                  ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]"
                  : "border-[var(--line-strong)] text-[var(--ink-3)] hover:border-[var(--ink)] hover:text-[var(--ink)]",
              )}
            >
              {on ? <Check className="mr-1 inline size-3" /> : "+ "}
              {shortLabel(unit)}
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        {tiers.slice(0, -1).map((tier, index) => {
          const previous = index === 0 ? 1 : (tiers[index - 1]?.upTo ?? 1) + 1;
          const next = tiers[index + 1];
          const max = Number.isFinite(next?.upTo)
            ? Math.max(previous, (next?.upTo ?? 4000) - 1)
            : 4000;
          return (
            <div key={tier.unit}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                <label
                  htmlFor={`${dimension}-${tier.unit}-threshold`}
                  className="rt-body text-[var(--ink-2)]"
                >
                  {shortLabel(tier.unit)} hands off to{" "}
                  {next ? shortLabel(next.unit) : "the next unit"}
                </label>
                <span className="rt-mono shrink-0 text-[var(--terracotta)]">
                  at {thresholdLabel(tier.upTo, dimension)}
                </span>
              </div>
              <div className="grid grid-cols-[1fr_5.5rem] items-center gap-3">
                <input
                  id={`${dimension}-${tier.unit}-threshold`}
                  type="range"
                  min={previous}
                  max={max}
                  step={tier.upTo < 50 ? 1 : tier.upTo < 500 ? 5 : 25}
                  value={Math.min(max, Math.max(previous, tier.upTo))}
                  onChange={(event) =>
                    setThreshold(index, event.currentTarget.valueAsNumber)
                  }
                  className="accent-[var(--terracotta)]"
                />
                <div className="flex items-center rounded-lg border border-[var(--line-strong)] bg-[var(--paper-warm)] px-2">
                  <input
                    aria-label={`${shortLabel(tier.unit)} upper threshold in ${dimension === "weight" ? "grams" : "millilitres"}`}
                    type="number"
                    min={previous}
                    max={max}
                    step="1"
                    value={Number(tier.upTo.toFixed(1))}
                    onChange={(event) => {
                      if (Number.isFinite(event.currentTarget.valueAsNumber)) {
                        setThreshold(index, event.currentTarget.valueAsNumber);
                      }
                    }}
                    className="rt-mono min-w-0 flex-1 bg-transparent py-1.5 outline-none"
                  />
                  <span className="rt-mono text-[var(--ink-3)]">
                    {dimension === "weight" ? "g" : "ml"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        {tiers.length === 1 && (
          <p className="rt-body text-sm text-[var(--ink-3)]">
            Every {dimension} is displayed in{" "}
            {shortLabel(tiers[0]?.unit ?? "g")}.
          </p>
        )}
      </div>
    </section>
  );
}

function formatSample(
  amount: number,
  unit: Unit,
  preference: UnitPreference,
): string {
  const converted = convertToSystem(amount, unit, preference);
  if (!converted) return `${amount} ${shortLabel(unit)}`;
  const rounded =
    converted.amount >= 100
      ? Math.round(converted.amount)
      : Number(converted.amount.toFixed(2));
  return `${rounded} ${shortLabel(converted.unit)}`;
}

export function UnitsPanel() {
  const [preference, setPreference] = useUnitPreference();

  return (
    <div>
      <PanelHead
        kicker="Units & measurements"
        title="Cook in your units."
        sub="Pick a starting system, then build your ladder. Choose the units you actually use and decide where each one hands off to the next. Recipes are re-expressed on the fly; the original is always kept."
      />

      <div className="mb-6">
        <p className="rt-mono mb-2 text-[var(--ink-3)]">Start from</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => {
            const on = preference.preset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setPreference(preferenceForSystem(preset.id))}
                aria-pressed={on}
                aria-label={preset.label}
                className={cn(
                  "min-w-28 rounded-xl border p-3 text-left transition-colors",
                  on
                    ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]"
                    : "border-[var(--line-strong)] bg-[var(--card)] hover:border-[var(--ink)]",
                )}
              >
                <span className="rt-display block text-2xl">
                  {preset.label}
                </span>
                <span
                  className={cn(
                    "rt-mono mt-1 block",
                    on ? "text-[var(--butter)]" : "text-[var(--ink-3)]",
                  )}
                >
                  {preset.sub}
                </span>
              </button>
            );
          })}
          <div
            className={cn(
              "min-w-28 rounded-xl border p-3",
              preference.preset === "custom"
                ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]"
                : "border-[var(--line-strong)] bg-[var(--card)] text-[var(--ink-3)]",
            )}
          >
            <span className="rt-display block text-2xl">Custom</span>
            <span className="rt-mono mt-1 block">your own ladder</span>
          </div>
        </div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="space-y-4">
          <Ladder
            dimension="weight"
            preference={preference}
            onChange={setPreference}
          />
          <Ladder
            dimension="volume"
            preference={preference}
            onChange={setPreference}
          />
          <button
            type="button"
            onClick={() => setPreference(preferenceForSystem("uk"))}
            className="rt-body inline-flex items-center gap-2 text-sm text-[var(--ink-3)] transition-colors hover:text-[var(--ink)]"
          >
            <RotateCcw className="size-4" /> Reset to UK defaults
          </button>
        </div>

        <aside className="overflow-hidden rounded-2xl border border-[var(--line-strong)] bg-[var(--card)] xl:sticky xl:top-24">
          <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--paper-warm)] px-4 py-3">
            <span className="rt-mono text-[var(--terracotta)]">
              Live · your units
            </span>
            <span className="rt-mono text-[var(--ink-4)]">original kept</span>
          </div>
          <div className="px-4 py-2">
            {SAMPLE.map((row) => (
              <div
                key={row.name}
                className="flex items-baseline gap-2 border-b border-dashed border-[var(--line)] py-2 last:border-0"
              >
                <span className="rt-body flex-1 text-sm text-[var(--ink-2)]">
                  {row.name}
                </span>
                <strong className="rt-display text-xl">
                  {formatSample(row.amount, row.unit, preference)}
                </strong>
                <span className="rt-mono text-right text-[var(--ink-4)]">
                  was {row.amount}
                  {shortLabel(row.unit)}
                </span>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <p role="status" className="rt-mono mt-5 text-[var(--sage)]">
        ● Changes save automatically on this device
      </p>
    </div>
  );
}
