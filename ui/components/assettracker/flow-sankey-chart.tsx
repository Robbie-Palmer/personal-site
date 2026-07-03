"use client";

import { type ReactElement, type SVGProps, useMemo } from "react";
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
  ACCOUNT_COLORS,
  type AccountSummaryView,
  type ExpectedReturnChange,
  effectiveExpectedReturn,
  formatCurrency,
  monthlyAmount,
  type RecurringFlow,
  todayIsoDate,
} from "@/lib/domain/assettracker";
import { useAssetTracker } from "./asset-tracker-provider";

const EXTERNAL_INCOME_NODE = "__external_income";
const EXTERNAL_SPENDING_NODE = "__external_spending";
const EXPECTED_RETURNS_NODE = "__expected_returns";
const INTEREST_CHARGED_NODE = "__interest_charged";
const MIN_SYNTHETIC_FLOW = 1;

type FlowSankeyAccount = AccountSummaryView & {
  expectedReturnChanges?: ExpectedReturnChange[];
};

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
  sourceName: string;
  targetName: string;
};

export type FlowSankeyData = {
  nodes: FlowSankeyNode[];
  links: FlowSankeyLink[];
};

function accountColor(index: number): string {
  return ACCOUNT_COLORS[index % ACCOUNT_COLORS.length] ?? ACCOUNT_COLORS[0];
}

function nodeName(id: string, account?: FlowSankeyAccount): string {
  switch (id) {
    case EXTERNAL_INCOME_NODE:
      return "External income";
    case EXTERNAL_SPENDING_NODE:
      return "External spending";
    case EXPECTED_RETURNS_NODE:
      return "Expected returns";
    case INTEREST_CHARGED_NODE:
      return "Interest charged";
    default:
      return account?.name ?? id;
  }
}

function nodeColor(id: string, index: number): string {
  switch (id) {
    case EXTERNAL_INCOME_NODE:
    case EXTERNAL_SPENDING_NODE:
      return "hsl(220, 10%, 60%)";
    case EXPECTED_RETURNS_NODE:
      return "hsl(145, 55%, 45%)";
    case INTEREST_CHARGED_NODE:
      return "hsl(350, 65%, 55%)";
    default:
      return accountColor(index);
  }
}

function monthlyExpectedChange(balance: number, annualRate: number): number {
  return balance * ((1 + annualRate) ** (1 / 12) - 1);
}

export function buildFlowSankeyData(
  accounts: FlowSankeyAccount[],
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
      name: nodeName(id, account),
      color: nodeColor(id, index),
    });
    nodeIndexes.set(id, index);
    return index;
  }

  function addLink(
    sourceId: string,
    targetId: string,
    value: number,
    label: string,
  ) {
    if (value <= 0) return;

    const source = addNode(sourceId);
    const target = addNode(targetId);
    const key = `${source}->${target}`;
    const existing = linkTotals.get(key);
    if (existing) {
      existing.value += value;
      existing.label = `${existing.label}, ${label}`;
      return;
    }

    const sourceNode = nodes[source];
    const targetNode = nodes[target];
    linkTotals.set(key, {
      source,
      target,
      value,
      label,
      sourceName: sourceNode?.name ?? sourceId,
      targetName: targetNode?.name ?? targetId,
    });
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

    addLink(sourceId, targetId, value, flow.name);
  }

  const today = todayIsoDate();
  for (const account of accounts) {
    const balance = account.latestBalance ?? 0;
    if (balance === 0) continue;

    const rate = effectiveExpectedReturn(account, today);
    if (rate === 0) continue;

    const change = monthlyExpectedChange(balance, rate);
    const value = Math.abs(change);
    if (value < MIN_SYNTHETIC_FLOW) continue;

    if (change > 0) {
      addLink(EXPECTED_RETURNS_NODE, account.id, value, "Expected return");
    } else if (balance < 0) {
      addLink(INTEREST_CHARGED_NODE, account.id, value, "Interest charged");
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

function FlowSankeyNodeShape({
  x,
  y,
  width,
  height,
  payload,
  showLabel,
}: SankeyNodeProps & {
  showLabel: boolean;
}): ReactElement<SVGProps<SVGRectElement>> {
  const node = payload as unknown as FlowSankeyNode & { value?: number };
  const depth = "depth" in payload ? Number(payload.depth) : 0;
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
      <p className="text-muted-foreground">
        {link.sourceName}
        {" -> "}
        {link.targetName}
      </p>
      <p className="font-mono">{formatCurrency(link.value)}/mo</p>
    </div>
  );
}

export function FlowSankeyChart() {
  const { accountDetails, recurringFlows } = useAssetTracker();
  const isCompact = useMediaQuery({ maxWidth: 639 });
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
  const chartMargin = isCompact
    ? { top: 8, right: 12, bottom: 8, left: 12 }
    : { top: 8, right: 140, bottom: 8, left: 120 };

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
            <div className="h-[280px] min-w-0 sm:h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <Sankey
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  node={(props) => (
                    <FlowSankeyNodeShape {...props} showLabel={!isCompact} />
                  )}
                  link={{
                    stroke: "hsl(220, 70%, 50%)",
                    strokeOpacity: 0.25,
                  }}
                  nodePadding={isCompact ? 14 : 18}
                  nodeWidth={12}
                  margin={chartMargin}
                  iterations={64}
                >
                  <Tooltip content={<SankeyTooltip />} />
                </Sankey>
              </ResponsiveContainer>
            </div>
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
