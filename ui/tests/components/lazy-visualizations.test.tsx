import { render, screen } from "@testing-library/react";
import { type ComponentType, createElement } from "react";
import { describe, expect, it, vi } from "vitest";

type DynamicCall = {
  loader: () => Promise<unknown>;
  options: {
    loading?: ComponentType;
    ssr?: boolean;
  };
};

const dynamicCalls = vi.hoisted(() => [] as DynamicCall[]);

vi.mock("next/dynamic", () => ({
  default: (loader: DynamicCall["loader"], options: DynamicCall["options"]) => {
    dynamicCalls.push({ loader, options });
    return function MockDynamicComponent() {
      return <div data-testid="dynamic-component" />;
    };
  },
}));

describe("lazy visualization wrappers", () => {
  it("defers every chart and provides client-only loading states", async () => {
    const wealthCharts = await import(
      "@/components/blog/how-to-build-wealth/lazy-wealth-charts"
    );
    const { LazyRechartsDemoChart } = await import(
      "@/components/technology/lazy-recharts-demo-chart"
    );

    expect(dynamicCalls).toHaveLength(5);
    expect(dynamicCalls.every(({ options }) => options.ssr === false)).toBe(
      true,
    );

    const loadedComponents = await Promise.all(
      dynamicCalls.map(({ loader }) => loader()),
    );
    expect(
      loadedComponents.every((component) => typeof component === "function"),
    ).toBe(true);

    const loadingComponents = dynamicCalls.flatMap(({ options }) =>
      options.loading ? [options.loading] : [],
    );

    render(
      <>
        <wealthCharts.DebtInvestmentChart />
        <wealthCharts.FinancialIndependenceChart />
        <wealthCharts.LisaComparisonChart />
        <wealthCharts.PensionReturnsChart />
        <LazyRechartsDemoChart />
        {loadingComponents.map((LoadingComponent, index) =>
          createElement(LoadingComponent, { key: index }),
        )}
      </>,
    );

    expect(screen.getAllByTestId("dynamic-component")).toHaveLength(5);
    expect(screen.getAllByText("Loading chart...")).toHaveLength(4);
    expect(screen.getByText("Loading charts...")).toBeInTheDocument();
  });
});
