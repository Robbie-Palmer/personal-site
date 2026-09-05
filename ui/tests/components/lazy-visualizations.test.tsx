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

vi.mock("@/components/technology/revealjs-demo", () => ({
  RevealJsDemo: () => <div data-testid="loaded-reveal-demo" />,
}));

vi.mock("@/components/projects/pitch-deck/project-pitch-deck", () => ({
  ProjectPitchDeck: () => <div data-testid="loaded-project-deck" />,
}));

describe("lazy visualization wrappers", () => {
  it("defers every chart and provides client-only loading states", async () => {
    const wealthCharts = await import(
      "@/components/blog/how-to-build-wealth/lazy-wealth-charts"
    );
    const { LazyRechartsDemoChart } = await import(
      "@/components/technology/lazy-recharts-demo-chart"
    );
    const { LazyRevealJsDemo } = await import(
      "@/components/technology/lazy-revealjs-demo"
    );
    const { LazyProjectPitchDeck } = await import(
      "@/components/projects/pitch-deck/lazy-project-pitch-deck"
    );

    expect(dynamicCalls).toHaveLength(7);
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

    const { container } = render(
      <>
        <wealthCharts.DebtInvestmentChart />
        <wealthCharts.FinancialIndependenceChart />
        <wealthCharts.LisaComparisonChart />
        <wealthCharts.PensionReturnsChart />
        <LazyRechartsDemoChart />
        <LazyRevealJsDemo>Deck content</LazyRevealJsDemo>
        <LazyProjectPitchDeck
          projectSlug="agentic-code-review"
          title="Agentic Code Review pitch"
        >
          Project deck content
        </LazyProjectPitchDeck>
        {loadingComponents.map((LoadingComponent, index) =>
          createElement(LoadingComponent, { key: index }),
        )}
      </>,
    );

    expect(screen.getAllByTestId("dynamic-component")).toHaveLength(7);
    expect(screen.getAllByText("Loading chart...")).toHaveLength(4);
    expect(screen.getByText("Loading charts...")).toBeInTheDocument();
    expect(screen.getAllByText("Loading presentation...")).toHaveLength(2);
    expect(container.querySelector("noscript")).toBeInTheDocument();
  });
});
