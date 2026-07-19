import type { Position } from "../domain/position.js";
import { manhattanDistance, comparePositions } from "../domain/position.js";

/**
 * One 4-directional step from `from` toward `target`, resolving the **x-axis before y**
 * (the locked tie-break). Returns `from` unchanged if already on the target. Because the
 * target is always in-bounds and we only ever step one cell toward it, the result stays
 * on the grid without needing a clamp.
 *
 * This is deliberately danger-blind: it never routes around occupied cells. If the chosen
 * step is blocked, the caller makes the mover wait — it does not try the other axis.
 */
export function stepToward(from: Position, target: Position): Position {
  const dx = target.x - from.x;
  if (dx !== 0) return { x: from.x + Math.sign(dx), y: from.y };
  const dy = target.y - from.y;
  if (dy !== 0) return { x: from.x, y: from.y + Math.sign(dy) };
  return from;
}

/**
 * The nearest candidate by Manhattan distance, breaking ties with the Cartesian x-then-y
 * rule so the choice is deterministic. Returns `undefined` for an empty list.
 */
export function nearest<T extends { readonly position: Position }>(
  from: Position,
  candidates: readonly T[],
): T | undefined {
  let best: T | undefined;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const distance = manhattanDistance(from, candidate.position);
    const closer = distance < bestDistance;
    const tieButLower =
      distance === bestDistance &&
      best !== undefined &&
      comparePositions(candidate.position, best.position) < 0;
    if (closer || tieButLower) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}
