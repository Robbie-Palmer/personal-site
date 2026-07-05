import posthog from "posthog-js";
import { toast } from "sonner";
import {
  filterAppliedAction,
  nextFilterState,
  type UseFilterParamsReturn,
} from "@/hooks/use-filter-params";

interface CycleFromCardArgs {
  filterParams: UseFilterParamsReturn;
  paramName: string;
  value: string;
  /** Human-readable label used in the toast (defaults to the raw value). */
  label?: string;
  /** Current page path, for analytics. */
  page: string;
}

/**
 * Advances a filter value off → include → exclude → off from a card badge.
 *
 * Because excluding a value hides the very card that was clicked, the exclude
 * step also raises an "Undo" toast so the action stays reversible in one tap
 * without hunting for the value in the filter bar.
 */
export function cycleFilterFromCard({
  filterParams,
  paramName,
  value,
  label,
  page,
}: CycleFromCardArgs): void {
  const previous = filterParams.peekState(paramName, value);
  const next = nextFilterState(previous);

  posthog.capture("filter_applied", {
    page,
    filter_type: paramName,
    filter_value: value,
    action: filterAppliedAction(next),
  });

  filterParams.setState(paramName, value, next);

  if (next === "exclude") {
    // A stable id keeps one toast per value (the same value can appear on many
    // cards), so a re-exclude replaces rather than stacks. The Undo restores
    // the prior state, but only if the value is still excluded — the user may
    // have already changed it via another surface while the toast was up.
    toast(`Excluded ${label ?? value}`, {
      id: `filter-exclude:${paramName}:${value}`,
      description: "Hidden from results.",
      action: {
        label: "Undo",
        onClick: () => {
          if (filterParams.peekState(paramName, value) === "exclude") {
            filterParams.setState(paramName, value, previous);
          }
        },
      },
    });
  }
}
