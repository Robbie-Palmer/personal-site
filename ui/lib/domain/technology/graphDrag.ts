const DRAG_PROPAGATION_BY_DEPTH = [1, 0.48, 0.2, 0.08] as const;

export function buildDragPropagationWeights(
  nodeCount: number,
  rootIndex: number,
  getNeighbors: (index: number) => readonly number[],
): Float32Array {
  const weights = new Float32Array(nodeCount);
  if (rootIndex < 0 || rootIndex >= nodeCount) return weights;

  const visited = new Set([rootIndex]);
  let frontier = [rootIndex];

  for (const weight of DRAG_PROPAGATION_BY_DEPTH) {
    const nextFrontier: number[] = [];
    for (const index of frontier) {
      weights[index] = weight;
      for (const neighbor of getNeighbors(index)) {
        if (neighbor < 0 || neighbor >= nodeCount || visited.has(neighbor)) {
          continue;
        }
        visited.add(neighbor);
        nextFrontier.push(neighbor);
      }
    }
    frontier = nextFrontier;
  }

  return weights;
}

export function applyDragDisplacement(
  basePositions: Float32Array,
  weights: Float32Array,
  deltaX: number,
  deltaY: number,
): Float32Array {
  const positions = new Float32Array(basePositions);
  for (let index = 0; index < weights.length; index += 1) {
    const weight = weights[index];
    const x = positions[index * 2];
    const y = positions[index * 2 + 1];
    if (
      !weight ||
      typeof x !== "number" ||
      typeof y !== "number" ||
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    )
      continue;
    positions[index * 2] = x + deltaX * weight;
    positions[index * 2 + 1] = y + deltaY * weight;
  }
  return positions;
}

export function getCollisionDisplacement(
  draggedPosition: readonly [number, number],
  obstaclePosition: readonly [number, number],
  minimumDistance: number,
  obstacleIndex: number,
): [number, number] {
  const deltaX = obstaclePosition[0] - draggedPosition[0];
  const deltaY = obstaclePosition[1] - draggedPosition[1];
  const distance = Math.hypot(deltaX, deltaY);
  if (distance >= minimumDistance) return [0, 0];

  if (distance < 0.001) {
    const angle = obstacleIndex * 2.399963;
    return [
      Math.cos(angle) * minimumDistance,
      Math.sin(angle) * minimumDistance,
    ];
  }

  const overlap = minimumDistance - distance;
  return [(deltaX / distance) * overlap, (deltaY / distance) * overlap];
}
