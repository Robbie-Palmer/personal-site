
import { describe, it, expect } from "vitest";
import { splitWords, aggregateMetrics } from "../../src/evaluation/metrics.js";

describe("splitWords", () => {
    it("should split words correctly", () => {
        expect(splitWords("hello world")).toEqual(["hello", "world"]);
    });

    it("should handle accented characters", () => {
        expect(splitWords("café standard")).toEqual(["café", "standard"]);
    });

    it("should handle non-Latin characters", () => {
        // Simple check to ensure we don't regress if we add more support
        expect(splitWords("你好 code")).toEqual(["你好", "code"]);
    });
});

describe("aggregateMetrics", () => {
    it("should throw error when input lengths differ", () => {
        expect(() => aggregateMetrics([], [{ expected: {} } as any])).toThrow(/Length mismatch/);
    });
});
