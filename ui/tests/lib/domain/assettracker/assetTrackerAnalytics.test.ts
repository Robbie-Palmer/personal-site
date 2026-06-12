import { describe, expect, it } from "vitest";
import {
  buildExpectedTrajectory,
  computeCagr,
} from "@/lib/domain/assettracker/assetTrackerAnalytics";

describe("computeCagr", () => {
  it("computes the annual growth rate over one year", () => {
    const cagr = computeCagr([
      { date: "2021-01-01", balance: 1000 },
      { date: "2022-01-01", balance: 2000 },
    ]);

    expect(cagr).not.toBeNull();
    expect(cagr).toBeCloseTo(1.0, 2);
  });

  it("annualises growth over multiple years", () => {
    // 1000 -> 1210 over ~2 years is ~10%/yr
    const cagr = computeCagr([
      { date: "2020-01-01", balance: 1000 },
      { date: "2022-01-01", balance: 1210 },
    ]);

    expect(cagr).toBeCloseTo(0.1, 2);
  });

  it("starts from the first positive balance", () => {
    const cagr = computeCagr([
      { date: "2020-01-01", balance: 0 },
      { date: "2021-01-01", balance: 1000 },
      { date: "2022-01-01", balance: 2000 },
    ]);

    expect(cagr).toBeCloseTo(1.0, 2);
  });

  it("returns null with fewer than two usable snapshots", () => {
    expect(computeCagr([])).toBeNull();
    expect(computeCagr([{ date: "2024-01-01", balance: 1000 }])).toBeNull();
  });

  it("returns null when no balance is positive", () => {
    expect(
      computeCagr([
        { date: "2023-01-01", balance: 0 },
        { date: "2024-01-01", balance: 0 },
      ]),
    ).toBeNull();
  });

  it("returns -100% when the balance drops to zero", () => {
    const cagr = computeCagr([
      { date: "2023-01-01", balance: 1000 },
      { date: "2024-01-01", balance: 0 },
    ]);

    expect(cagr).toBeCloseTo(-1, 5);
  });
});

describe("buildExpectedTrajectory", () => {
  it("anchors the first expected point to the first actual balance", () => {
    const trajectory = buildExpectedTrajectory(0.1, [
      { date: "2023-01-01", balance: 1000 },
      { date: "2024-01-01", balance: 1200 },
    ]);

    expect(trajectory[0]).toEqual({
      date: "2023-01-01",
      actual: 1000,
      expected: 1000,
    });
  });

  it("compounds the previous actual balance at the expected return", () => {
    const trajectory = buildExpectedTrajectory(0.1, [
      { date: "2023-01-01", balance: 1000 },
      { date: "2024-01-01", balance: 1200 },
    ]);

    // ~1 year at 10% from the previous actual of 1000
    expect(trajectory[1]?.actual).toBe(1200);
    expect(trajectory[1]?.expected).toBeCloseTo(1100, 0);
  });

  it("re-anchors after each entry rather than compounding the divergence", () => {
    const trajectory = buildExpectedTrajectory(0.1, [
      { date: "2022-01-01", balance: 1000 },
      { date: "2023-01-01", balance: 5000 }, // big contribution landed
      { date: "2024-01-01", balance: 5400 },
    ]);

    // The third expected point grows from the actual 5000, not from 1100
    expect(trajectory[2]?.expected).toBeCloseTo(5500, 0);
  });

  it("sorts snapshots by date before building the series", () => {
    const trajectory = buildExpectedTrajectory(0.05, [
      { date: "2024-01-01", balance: 1200 },
      { date: "2023-01-01", balance: 1000 },
    ]);

    expect(trajectory.map((p) => p.date)).toEqual(["2023-01-01", "2024-01-01"]);
  });
});
