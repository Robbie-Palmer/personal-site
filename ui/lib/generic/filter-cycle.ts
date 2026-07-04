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
  const previous = filterParams.getState(paramName, value);
  const next = nextFilterState(previous);

  posthog.capture("filter_applied", {
    page,
    filter_type: paramName,
    filter_value: value,
    action: filterAppliedAction(next),
  });

  filterParams.setState(paramName, value, next);

  if (next === "exclude") {
    toast(`Excluded ${label ?? value}`, {
      description: "Hidden from results.",
      action: {
        label: "Undo",
        onClick: () => filterParams.setState(paramName, value, previous),
      },
    });
  }
}
