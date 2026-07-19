/**
 * A cell on the warehouse grid. Zero-indexed; (0,0) is the top-left, x is horizontal,
 * y is vertical. Positions are immutable value objects — movement produces a new one
 * rather than mutating in place, which keeps the simulation core easy to reason about.
 */
export interface Position {
  readonly x: number;
  readonly y: number;
}

/**
 * Manhattan distance: |dx| + |dy|. This is the *right* metric for our world because
 * movement is 4-directional (no diagonals), so the number of orthogonal steps between
 * two cells is exactly this sum.
 */
export function manhattanDistance(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** True when two positions refer to the same cell. */
export function samePosition(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}

/**
 * Cartesian ordering — by x ascending, then y ascending. This is the single source of
 * truth for every deterministic tie-break in the sim (which equidistant target to pick,
 * which axis to step along), so runs stay reproducible.
 */
export function comparePositions(a: Position, b: Position): number {
  return a.x - b.x || a.y - b.y;
}

/** A stable string key for a cell, for use in Map/Set lookups. */
export function positionKey(p: Position): string {
  return `${p.x},${p.y}`;
}
