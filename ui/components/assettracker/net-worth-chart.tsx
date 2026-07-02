"use client";
import { useMemo, useRef, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  ACCOUNT_COLORS,
  formatCurrency,
  type NetWorthDataPoint,
} from "@/lib/domain/assettracker";
import { cn } from "@/lib/generic/styles";

const LONG_PRESS_MS = 450;

function seriesColor(index: number): string {
  return ACCOUNT_COLORS[index % ACCOUNT_COLORS.length] ?? ACCOUNT_COLORS[0];
}

interface NetWorthChartProps {
  data: NetWorthDataPoint[];
}

export function NetWorthChart({ data }: NetWorthChartProps) {
  // Every point carries every series key, so the last point names them all
  // (mortgages folded into their property never appear — no dead legend pills)
  const seriesNames = useMemo(() => {
    const last = data[data.length - 1];
    if (!last) return [];
    return Object.keys(last).filter((key) => key !== "date" && key !== "total");
  }, [data]);

  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  // Ignore hidden entries for series that no longer exist (import/reset)
  const isFiltered = seriesNames.some((name) => hidden.has(name));

  // The bold total line tracks the visible subset, so focusing one account
  // shows that account's own trajectory rather than the full net worth
  const chartData = useMemo(() => {
    const visibleNames = seriesNames.filter((name) => !hidden.has(name));
    if (visibleNames.length === seriesNames.length) return data;
    return data.map((point) => ({
      ...point,
      total: visibleNames.reduce(
        (sum, name) => sum + (Number(point[name]) || 0),
        0,
      ),
    }));
  }, [data, seriesNames, hidden]);

  function soloSeries(name: string) {
    setHidden((previous) => {
      const isOnlyVisible =
        !previous.has(name) && previous.size === seriesNames.length - 1;
      if (isOnlyVisible) return new Set();
      return new Set(seriesNames.filter((other) => other !== name));
    });
  }

  function toggleSeries(name: string) {
    setHidden((previous) => {
      const next = new Set(previous);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      // Hiding the last visible series means "start over", not an empty chart
      if (next.size === seriesNames.length) return new Set();
      return next;
    });
  }

  const chartConfig: ChartConfig = {
    total: {
      label: isFiltered ? "Selected total" : "Net worth",
      color: "var(--foreground)",
    },
  };
  for (const [i, name] of seriesNames.entries()) {
    chartConfig[name] = {
      label: name,
      color: seriesColor(i),
    };
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Net Worth Over Time</CardTitle>
        <CardDescription>
          Stacked account balances with net worth as the bold line — liability
          accounts stack below zero, so the line is the true total.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <ChartContainer config={chartConfig} className="aspect-auto w-full">
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart
              data={chartData}
              stackOffset="sign"
              margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" className="text-xs" />
              <YAxis
                className="text-xs"
                tickFormatter={(v: number) => `£${(v / 1000).toFixed(0)}k`}
              />
              <ReferenceLine y={0} className="stroke-muted-foreground" />
              <ChartTooltip
                content={<ChartTooltipContent />}
                formatter={(value) => formatCurrency(value as number)}
              />
              {seriesNames.map((name, i) =>
                hidden.has(name) ? null : (
                  <Area
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stackId="1"
                    stroke={seriesColor(i)}
                    fill={seriesColor(i)}
                    fillOpacity={0.3}
                  />
                ),
              )}
              <Line
                type="monotone"
                dataKey="total"
                stroke="var(--foreground)"
                strokeWidth={2.5}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartContainer>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
          {seriesNames.map((name, i) => (
            <LegendPill
              key={name}
              name={name}
              color={seriesColor(i)}
              isHidden={hidden.has(name)}
              onSolo={() => soloSeries(name)}
              onToggle={() => toggleSeries(name)}
            />
          ))}
          {isFiltered && (
            <button
              type="button"
              className="rounded-full border px-2.5 py-1 text-xs font-medium hover:bg-accent"
              onClick={() => setHidden(new Set())}
            >
              Show all
            </button>
          )}
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Click an account to focus it · Ctrl/⌘-click or long-press to show/hide
          it
        </p>
      </CardContent>
    </Card>
  );
}

interface LegendPillProps {
  name: string;
  color: string;
  isHidden: boolean;
  onSolo(): void;
  onToggle(): void;
}

/**
 * Grafana-style legend entry: plain click focuses (solos) the series, a
 * modified click toggles it in/out. On touch there are no modifier keys, so
 * a long-press stands in for ctrl-click.
 */
function LegendPill({
  name,
  color,
  isHidden,
  onSolo,
  onToggle,
}: LegendPillProps) {
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  function startPress() {
    longPressFired.current = false;
    pressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      onToggle();
    }, LONG_PRESS_MS);
  }

  function cancelPress() {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }

  function handleClick(event: React.MouseEvent) {
    // The click that follows a completed long-press must not also solo
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      onToggle();
    } else {
      onSolo();
    }
  }

  return (
    <button
      type="button"
      aria-pressed={!isHidden}
      className={cn(
        "flex select-none items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-opacity hover:bg-accent",
        isHidden && "opacity-40 line-through",
      )}
      onPointerDown={startPress}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      onPointerCancel={cancelPress}
      onClick={handleClick}
      onContextMenu={(event) => event.preventDefault()}
    >
      <span
        aria-hidden="true"
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      {name}
    </button>
  );
}
