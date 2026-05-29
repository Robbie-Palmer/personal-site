import {
  convertToSystem,
  convertUnit,
  getUnitDimension,
} from "recipe-domain/conversion";
import { describe, expect, it } from "vitest";

describe("convertUnit", () => {
  it("converts within metric volume", () => {
    expect(convertUnit(1, "l", "ml")).toBe(1000);
    expect(convertUnit(500, "ml", "l")).toBe(0.5);
  });

  it("converts between metric and cup variants", () => {
    expect(convertUnit(1, "uk_cup", "ml")).toBe(250);
    expect(convertUnit(1, "us_cup", "ml")).toBeCloseTo(236.588);
    expect(convertUnit(1, "au_cup", "ml")).toBe(250);
    expect(convertUnit(1, "uk_imperial_cup", "ml")).toBeCloseTo(284.131);
  });

  it("converts between pint variants", () => {
    expect(convertUnit(1, "uk_pint", "ml")).toBeCloseTo(568.261);
    expect(convertUnit(1, "us_pint", "ml")).toBeCloseTo(473.176);
  });

  it("converts between cup variants", () => {
    const usCupInUkCups = convertUnit(1, "us_cup", "uk_cup");
    expect(usCupInUkCups).toBeCloseTo(236.588 / 250);
  });

  it("converts within metric weight", () => {
    expect(convertUnit(1, "kg", "g")).toBe(1000);
    expect(convertUnit(250, "g", "kg")).toBe(0.25);
  });

  it("converts between weight units", () => {
    expect(convertUnit(1, "lb", "g")).toBeCloseTo(453.592);
    expect(convertUnit(1, "oz", "g")).toBeCloseTo(28.3495);
  });

  it("returns null for incompatible dimensions", () => {
    expect(convertUnit(1, "ml", "g")).toBeNull();
    expect(convertUnit(1, "kg", "l")).toBeNull();
  });

  it("returns null for non-convertible units", () => {
    expect(convertUnit(1, "piece", "g")).toBeNull();
    expect(convertUnit(1, "pinch", "ml")).toBeNull();
  });
});

describe("getUnitDimension", () => {
  it("returns volume for volume units", () => {
    expect(getUnitDimension("ml")).toBe("volume");
    expect(getUnitDimension("us_cup")).toBe("volume");
    expect(getUnitDimension("uk_pint")).toBe("volume");
    expect(getUnitDimension("tsp")).toBe("volume");
  });

  it("returns weight for weight units", () => {
    expect(getUnitDimension("g")).toBe("weight");
    expect(getUnitDimension("lb")).toBe("weight");
  });

  it("returns null for non-convertible units", () => {
    expect(getUnitDimension("piece")).toBeNull();
    expect(getUnitDimension("handful")).toBeNull();
    expect(getUnitDimension("bag")).toBeNull();
  });
});

describe("convertToSystem", () => {
  describe("metric system", () => {
    it("keeps ml below 1000", () => {
      const result = convertToSystem(250, "ml", "metric");
      expect(result).toEqual({ amount: 250, unit: "ml" });
    });

    it("promotes to l at 1000ml", () => {
      const result = convertToSystem(1000, "ml", "metric");
      expect(result).toEqual({ amount: 1, unit: "l" });
    });

    it("converts us_cup to ml", () => {
      const result = convertToSystem(1, "us_cup", "metric");
      expect(result?.unit).toBe("ml");
      expect(result?.amount).toBeCloseTo(236.588);
    });

    it("keeps g below 1000", () => {
      expect(convertToSystem(500, "g", "metric")).toEqual({
        amount: 500,
        unit: "g",
      });
    });

    it("promotes to kg at 1000g", () => {
      expect(convertToSystem(1000, "g", "metric")).toEqual({
        amount: 1,
        unit: "kg",
      });
    });

    it("converts lb to g/kg", () => {
      const result = convertToSystem(1, "lb", "metric");
      expect(result?.unit).toBe("g");
      expect(result?.amount).toBeCloseTo(453.592);
    });
  });

  describe("US system", () => {
    it("uses tsp for very small volumes", () => {
      const result = convertToSystem(5, "ml", "us");
      expect(result?.unit).toBe("tsp");
      expect(result?.amount).toBe(1);
    });

    it("uses tbsp for small volumes", () => {
      const result = convertToSystem(15, "ml", "us");
      expect(result?.unit).toBe("tbsp");
      expect(result?.amount).toBe(1);
    });

    it("keeps 3 tbsp as tbsp rather than converting to an awkward 0.19 cups", () => {
      const result = convertToSystem(45, "ml", "us");
      expect(result?.unit).toBe("tbsp");
      expect(result?.amount).toBe(3);
    });

    it("uses cup for medium volumes", () => {
      const result = convertToSystem(250, "ml", "us");
      expect(result?.unit).toBe("us_cup");
      expect(result?.amount).toBeCloseTo(250 / 236.588);
    });

    it("uses pint for large volumes", () => {
      const result = convertToSystem(600, "ml", "us");
      expect(result?.unit).toBe("us_pint");
    });

    it("uses oz for small weights", () => {
      const result = convertToSystem(100, "g", "us");
      expect(result?.unit).toBe("oz");
      expect(result?.amount).toBeCloseTo(100 / 28.3495);
    });

    it("uses lb for large weights", () => {
      const result = convertToSystem(500, "g", "us");
      expect(result?.unit).toBe("lb");
      expect(result?.amount).toBeCloseTo(500 / 453.592);
    });
  });

  describe("UK system", () => {
    it("uses tsp for very small volumes", () => {
      expect(convertToSystem(5, "ml", "uk")?.unit).toBe("tsp");
    });

    it("uses tbsp for small volumes", () => {
      expect(convertToSystem(30, "ml", "uk")?.unit).toBe("tbsp");
    });

    it("uses ml for medium volumes", () => {
      expect(convertToSystem(250, "ml", "uk")).toEqual({
        amount: 250,
        unit: "ml",
      });
    });

    it("uses l for large volumes", () => {
      expect(convertToSystem(1500, "ml", "uk")).toEqual({
        amount: 1.5,
        unit: "l",
      });
    });

    it("uses g for small weights", () => {
      expect(convertToSystem(200, "g", "uk")).toEqual({
        amount: 200,
        unit: "g",
      });
    });

    it("uses kg for large weights", () => {
      expect(convertToSystem(2000, "g", "uk")).toEqual({
        amount: 2,
        unit: "kg",
      });
    });
  });

  it("returns null for non-convertible units", () => {
    expect(convertToSystem(3, "piece", "metric")).toBeNull();
    expect(convertToSystem(1, "pinch", "us")).toBeNull();
  });
});
