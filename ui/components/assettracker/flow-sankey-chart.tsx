"use client";

import { type ReactElement, type SVGProps, useMemo } from "react";
import {
  ResponsiveContainer,
  Sankey,
  type SankeyLinkProps,
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
  ACCOUNT_COLORS,
  type AccountSummaryView,
  formatCurrency,
  monthlyAmount,
  type RecurringFlow,
} from "@/lib/domain/assettracker";
import { useAssetTracker } from "./asset-tracker-provider";

const EXTERNAL_INCOME_NODE = "__external_income";
const EXTERNAL_SPENDING_NODE = "__external_spending";

type FlowSankeyNode = {
  id: string;
  name: string;
  color: string;
};

type FlowSankeyLink = {
  source: number;
  target: number;
  value: number;
  label: string;
};

export type FlowSankeyData = {
  nodes: FlowSankeyNode[];
  links: FlowSankeyLink[];
};

function accountColor(index: number): string {
  return ACCOUNT_COLORS[index % ACCOUNT_COLORS.length] ?? ACCOUNT_COLORS[0];
}

export function buildFlowSankeyData(
  accounts: AccountSummaryView[],
  flows: RecurringFlow[],
  liabilityBalances: Record<string, number>,
): FlowSankeyData {
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const nodeIndexes = new Map<string, number>();
  const nodes: FlowSankeyNode[] = [];
  const linkTotals = new Map<string, FlowSankeyLink>();

  function addNode(id: string): number {
    const existing = nodeIndexes.get(id);
    if (existing != null) return existing;
    const account = accountById.get(id);
    const index = nodes.length;
    nodes.push({
      id,
      name:
        id === EXTERNAL_INCOME_NODE
          ? "External income"
          : id === EXTERNAL_SPENDING_NODE
            ? "External spending"
            : (account?.name ?? id),
      color:
        id === EXTERNAL_INCOME_NODE || id === EXTERNAL_SPENDING_NODE
          ? "hsl(220, 10%, 60%)"
          : accountColor(index),
    });
    nodeIndexes.set(id, index);
    return index;
  }

  for (const flow of flows) {
    const sourceId = flow.fromAccountId ?? EXTERNAL_INCOME_NODE;
    const targetId = flow.toAccountId ?? EXTERNAL_SPENDING_NODE;
    const liabilityBalance =
      flow.toAccountId != null
        ? liabilityBalances[flow.toAccountId]
        : undefined;
    const value = flow.formula
      ? monthlyAmount(flow, liabilityBalance)
      : monthlyAmount(flow);

    if (value <= 0) continue;

    const source = addNode(sourceId);
    const target = addNode(targetId);
    const key = `${source}->${target}`;
    const existing = linkTotals.get(key);
    if (existing) {
      existing.value += value;
      existing.label = `${existing.label}, ${flow.name}`;
    } else {
      linkTotals.set(key, {
        source,
        target,
        value,
        label: flow.name,
      });
    }
  }

  return {
    nodes,
    links: Array.from(linkTotals.values()).map((link) => ({
      ...link,
      value: Math.round(link.value * 100) / 100,
    })),
  };
}

function SankeyNode({
  x,
  y,
  width,
  height,
  payload,
}: SankeyNodeProps): ReactElement<SVGProps<SVGRectElement>> {
  const node = payload as unknown as FlowSankeyNode & { value?: number };
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
      <text
        x={x + width + 6}
        y={y + Math.max(height / 2, 10)}
        fill="currentColor"
        fontSize={11}
        dominantBaseline="middle"
      >
        {node.name}
      </text>
    </g>
  );
}

function SankeyLink({
  sourceX,
  targetX,
  sourceY,
  targetY,
  sourceControlX,
  targetControlX,
  sourceRelativeY,
  targetRelativeY,
  linkWidth,
}: SankeyLinkProps): ReactElement<SVGProps<SVGPathElement>> {
  const source = sourceY + sourceRelativeY + linkWidth / 2;
  const target = targetY + targetRelativeY + linkWidth / 2;
  return (
    <path
      d={`M${sourceX},${source} C${sourceControlX},${source} ${targetControlX},${target} ${targetX},${target}`}
      fill="none"
      stroke="hsl(220, 70%, 50%)"
      strokeOpacity={0.25}
      strokeWidth={Math.max(1, linkWidth)}
    />
  );
}

function SankeyTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: FlowSankeyLink }>;
}) {
  const link = payload?.[0]?.payload;
  if (!active || !link) return null;
  return (
    <div className="rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-medium">{link.label}</p>
      <p className="font-mono">{formatCurrency(link.value)}/mo</p>
    </div>
  );
}

export function FlowSankeyChart() {
  const { accounts, accountDetails, recurringFlows } = useAssetTracker();
  const liabilityBalances = useMemo(
    () =>
      Object.fromEntries(
        accountDetails.map((detail) => [detail.id, detail.latestBalance ?? 0]),
      ),
    [accountDetails],
  );
  const data = useMemo(
    () => buildFlowSankeyData(accounts, recurringFlows, liabilityBalances),
    [accounts, recurringFlows, liabilityBalances],
  );

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Regular Flow Map</CardTitle>
        <CardDescription>
          Monthly-equivalent expected flows between income, accounts, savings,
          and liabilities.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        {data.links.length === 0 ? (
          <p className="px-2 text-sm text-muted-foreground">
            No regular flows yet. Add income, contributions, or repayments from
            an account's detail view.
          </p>
        ) : (
          <div className="h-[320px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <Sankey
                data={data}
                dataKey="value"
                nameKey="name"
                node={SankeyNode}
                link={SankeyLink}
                nodePadding={18}
                nodeWidth={12}
                margin={{ top: 8, right: 140, bottom: 8, left: 8 }}
                iterations={64}
              >
                <Tooltip content={<SankeyTooltip />} />
              </Sankey>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
