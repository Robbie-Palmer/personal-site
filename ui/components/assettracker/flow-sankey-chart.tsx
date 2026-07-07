"use client";

import {
  type ReactElement,
  type SVGProps,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useMediaQuery } from "react-responsive";
import {
  ResponsiveContainer,
  Sankey,
  type SankeyNodeProps,
  Tooltip,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  buildFlowSankeyData,
  type FlowSankeyLink,
  type FlowSankeyNode,
  formatCurrency,
} from "@/lib/domain/assettracker";
import { useAssetTracker } from "./asset-tracker-provider";

function FlowSankeyNodeShape({
  x,
  y,
  width,
  height,
  payload,
  showLabel,
}: SankeyNodeProps & {
  showLabel: boolean;
}): ReactElement<SVGProps<SVGGElement>> {
  const node = payload as unknown as FlowSankeyNode & { value?: number };
  const rawDepth = "depth" in payload ? payload.depth : 0;
  const depth =
    typeof rawDepth === "number" && Number.isFinite(rawDepth) ? rawDepth : 0;
  const labelOnLeft = depth === 0;
  const labelX = labelOnLeft ? x - 8 : x + width + 8;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={4}
        fill={node.color}
        fillOpacity={0.85}
      />
      {showLabel && (
        <text
          x={labelX}
          y={y + Math.max(height / 2, 10)}
          fill="currentColor"
          fontSize={11}
          textAnchor={labelOnLeft ? "end" : "start"}
          dominantBaseline="middle"
        >
          {node.name}
        </text>
      )}
    </g>
  );
}

type SankeyTooltipItem = Partial<FlowSankeyLink & FlowSankeyNode> & {
  value?: number;
  source?: Readonly<{ name?: string }>;
  target?: Readonly<{ name?: string }>;
};

function SankeyTooltip({
  active,
  payload,
}: Readonly<{
  active?: boolean;
  payload?: ReadonlyArray<Readonly<{ payload?: SankeyTooltipItem }>>;
}>) {
  const item = payload?.[0]?.payload;
  if (!active || item?.value == null) return null;

  const sourceName = item.sourceName ?? item.source?.name;
  const targetName = item.targetName ?? item.target?.name;
  return (
    <div className="rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-medium">{item.label ?? item.name}</p>
      {sourceName && targetName && (
        <p className="text-muted-foreground">
          {sourceName}
          {" -> "}
          {targetName}
        </p>
      )}
      <p className="font-mono">{formatCurrency(item.value)}/mo</p>
    </div>
  );
}

function LabeledFlowSankeyNodeShape(props: SankeyNodeProps) {
  return <FlowSankeyNodeShape {...props} showLabel />;
}

function CompactFlowSankeyNodeShape(props: SankeyNodeProps) {
  return <FlowSankeyNodeShape {...props} showLabel={false} />;
}

export function FlowSankeyChart() {
  const { accountDetails, recurringFlows } = useAssetTracker();
  const [mounted, setMounted] = useState(false);
  const compactQuery = useMediaQuery({ maxWidth: 639 });
  const isCompact = mounted && compactQuery;
  const liabilityBalances = useMemo(
    () =>
      Object.fromEntries(
        accountDetails.map((detail) => [detail.id, detail.latestBalance ?? 0]),
      ),
    [accountDetails],
  );
  const data = useMemo(
    () =>
      buildFlowSankeyData(accountDetails, recurringFlows, liabilityBalances),
    [accountDetails, recurringFlows, liabilityBalances],
  );
  useEffect(() => {
    setMounted(true);
  }, []);

  const chartMargin = isCompact
    ? { top: 8, right: 12, bottom: 8, left: 12 }
    : { top: 8, right: 140, bottom: 8, left: 120 };
  const nodeRenderer = isCompact
    ? CompactFlowSankeyNodeShape
    : LabeledFlowSankeyNodeShape;

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Regular Flow Map</CardTitle>
        <CardDescription>
          Monthly-equivalent cash flows, expected returns, and interest charges.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        {data.links.length === 0 ? (
          <p className="px-2 text-sm text-muted-foreground">
            No regular flows yet. Add income, contributions, or repayments from
            an account's detail view.
          </p>
        ) : (
          <>
            {mounted ? (
              <div className="h-[280px] min-w-0 sm:h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <Sankey
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    node={nodeRenderer}
                    link={{
                      stroke: "hsl(220, 70%, 50%)",
                      strokeOpacity: 0.25,
                    }}
                    nodePadding={isCompact ? 14 : 18}
                    nodeWidth={12}
                    margin={chartMargin}
                    align="left"
                    iterations={64}
                  >
                    <Tooltip content={<SankeyTooltip />} />
                  </Sankey>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[280px] min-w-0 sm:h-[320px]" />
            )}
            <ul
              aria-label="Flow map legend"
              className="mt-3 flex flex-wrap gap-2 text-xs sm:hidden"
            >
              {data.nodes.map((node) => (
                <li
                  key={node.id}
                  className="inline-flex min-w-0 items-center gap-1.5 rounded-full border px-2 py-1"
                >
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: node.color }}
                  />
                  <span className="min-w-0 truncate">{node.name}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
