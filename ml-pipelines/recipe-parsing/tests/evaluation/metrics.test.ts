
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
    it("should treat missing predictions as failed entries", () => {
        const expectedRecipe = {
            title: "Test",
            description: "Test recipe",
            servings: 2,
            ingredientGroups: [{ items: [{ ingredient: "olive-oil", amount: 1, unit: "tbsp" }] }],
            instructions: ["Mix well"],
        };

        const { metrics, perEntry } = aggregateMetrics([], [
            {
                images: ["img-1.jpg"],
                expected: expectedRecipe,
            } as any,
        ]);

        expect(metrics.entryCount).toBe(1);
        expect(metrics.overall.score).toBe(0);
        expect(perEntry).toHaveLength(1);
        expect(perEntry[0]!.missingPrediction).toBe(true);
        expect(perEntry[0]!.scores.overall).toBe(0);
    });
});
