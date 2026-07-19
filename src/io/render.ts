import type { Entity } from "../domain/entities.js";
import { positionKey } from "../domain/position.js";

/** Above this grid size, per-cell rendering is noise rather than insight, so we skip it. */
export const MAX_RENDER_SIZE = 40;

const LEGEND = "Z = walker   L = Lab   P = Precinct   * = resource   . = empty";

function symbol(entity: Entity): string {
  switch (entity.kind) {
    case "walker":
      return "Z";
    case "resource":
      return "*";
    case "survivor":
      return entity.faction === "lab" ? "L" : "P";
  }
}

/**
 * Render the grid as ASCII. A mobile entity always takes precedence over a resource on the
 * same cell (there is at most one mobile per cell), so a survivor standing on an
 * about-to-be-claimed resource shows as the survivor.
 */
export function renderGrid(entities: readonly Entity[], gridSize: number): string {
  if (gridSize > MAX_RENDER_SIZE) {
    return `  (grid ${gridSize}×${gridSize} too large to draw; ${LEGEND})`;
  }

  const cells = new Map<string, string>();
  for (const entity of entities) {
    if (entity.kind === "resource") cells.set(positionKey(entity.position), symbol(entity));
  }
  for (const entity of entities) {
    if (entity.kind !== "resource") cells.set(positionKey(entity.position), symbol(entity));
  }

  const lines: string[] = [];
  for (let y = 0; y < gridSize; y++) {
    const row: string[] = [];
    for (let x = 0; x < gridSize; x++) {
      row.push(cells.get(`${x},${y}`) ?? ".");
    }
    lines.push("  " + row.join(" "));
  }
  return lines.join("\n");
}

export { LEGEND };
