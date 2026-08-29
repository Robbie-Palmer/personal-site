import { describe, expect, it } from "vitest";
import {
  applyDragDisplacement,
  buildDragPropagationWeights,
  getCollisionDisplacement,
} from "@/lib/domain/technology/graphDrag";

describe("graph drag propagation", () => {
  it("falls off through connected nodes without revisiting cycles", () => {
    const neighbors = [[1, 2], [0, 2], [0, 1, 3], [2, 4], [3], []];

    const weights = buildDragPropagationWeights(
      neighbors.length,
      0,
      (index) => neighbors[index] ?? [],
    );

    expect([...weights]).toEqual([
      1,
      expect.closeTo(0.48),
      expect.closeTo(0.48),
      expect.closeTo(0.2),
      expect.closeTo(0.08),
      0,
    ]);
  });

  it("moves finite positions by their weight and leaves absent nodes alone", () => {
    const positions = new Float32Array([0, 0, 10, 20, Number.NaN, Number.NaN]);
    const weights = new Float32Array([1, 0.5, 0.25]);

    const displaced = applyDragDisplacement(positions, weights, 8, -4);

    expect([...displaced.slice(0, 4)]).toEqual([8, -4, 14, 18]);
    expect(Number.isNaN(displaced[4])).toBe(true);
    expect(Number.isNaN(displaced[5])).toBe(true);
  });

  it("pushes an overlapping node to the collision boundary", () => {
    const displacement = getCollisionDisplacement([0, 0], [3, 4], 10, 1);

    expect(displacement[0]).toBeCloseTo(3);
    expect(displacement[1]).toBeCloseTo(4);
  });

  it("does not move a node outside the collision boundary", () => {
    expect(getCollisionDisplacement([0, 0], [6, 8], 10, 1)).toEqual([0, 0]);
  });
});
