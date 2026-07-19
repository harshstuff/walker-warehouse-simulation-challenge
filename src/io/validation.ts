import {
  type Position,
  type Scenario,
  type SimulationConfig,
  type Faction,
  DEFAULT_COMBAT_WIN_CHANCE,
  defaultMaxTurns,
  positionKey,
} from "../domain/index.js";

/**
 * The result of validating untrusted input. We accumulate *all* problems rather than
 * failing on the first, so a user fixing a scenario file sees everything at once.
 */
export type ValidationResult =
  | { readonly ok: true; readonly value: Scenario }
  | { readonly ok: false; readonly errors: readonly string[] };

const DEFAULT_SEED = 1;
const MAX_GRID_SIZE = 1000;
const MAX_TURN_LIMIT = 1_000_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

/** Parse and bounds-check one named array of positions, pushing any problems onto `errors`. */
function parsePositions(
  raw: unknown,
  field: string,
  gridSize: number,
  errors: string[],
): Position[] {
  if (!Array.isArray(raw)) {
    errors.push(`"${field}" must be an array of { x, y } positions.`);
    return [];
  }

  const positions: Position[] = [];
  (raw as readonly unknown[]).forEach((item, i) => {
    if (!isRecord(item)) {
      errors.push(`${field}[${i}] must be an object with integer x and y.`);
      return;
    }
    const x = item.x;
    const y = item.y;
    if (!isInteger(x) || !isInteger(y)) {
      errors.push(`${field}[${i}] must have integer x and y.`);
      return;
    }
    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) {
      errors.push(`${field}[${i}] (${x}, ${y}) is outside the ${gridSize}×${gridSize} grid.`);
      return;
    }
    positions.push({ x, y });
  });
  return positions;
}

/** Resolve the optional `config` block against the defaults, validating any overrides. */
function parseConfig(raw: unknown, gridSize: number, errors: string[]): SimulationConfig {
  const combatWinChance: Record<Faction, number> = { ...DEFAULT_COMBAT_WIN_CHANCE };
  let maxTurns = defaultMaxTurns(gridSize);

  if (raw === undefined) {
    return { combatWinChance, maxTurns };
  }
  if (!isRecord(raw)) {
    errors.push(`"config" must be an object.`);
    return { combatWinChance, maxTurns };
  }

  const rawOdds = raw.combatWinChance;
  if (rawOdds !== undefined) {
    if (!isRecord(rawOdds)) {
      errors.push(`"config.combatWinChance" must be an object.`);
    } else {
      for (const faction of ["lab", "precinct"] as const) {
        const value = rawOdds[faction];
        if (value === undefined) continue;
        if (!isFiniteNumber(value) || value < 0 || value > 1) {
          errors.push(`"config.combatWinChance.${faction}" must be a number in [0, 1].`);
        } else {
          combatWinChance[faction] = value;
        }
      }
    }
  }

  const rawMaxTurns = raw.maxTurns;
  if (rawMaxTurns !== undefined) {
    if (!isInteger(rawMaxTurns) || rawMaxTurns < 1 || rawMaxTurns > MAX_TURN_LIMIT) {
      errors.push(`"config.maxTurns" must be an integer between 1 and ${MAX_TURN_LIMIT}.`);
    } else {
      maxTurns = rawMaxTurns;
    }
  }

  return { combatWinChance, maxTurns };
}

/**
 * Validate arbitrary parsed JSON into a trusted Scenario. This is the single boundary
 * where untrusted input becomes typed domain data — everything downstream can rely on
 * the invariants enforced here (in-bounds positions, one mobile entity per start cell,
 * distinct resource cells, a solvable board).
 */
export function validateScenario(input: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return { ok: false, errors: ["Scenario must be a JSON object."] };
  }

  let gridSize = 0;
  if (!isInteger(input.gridSize) || input.gridSize < 1 || input.gridSize > MAX_GRID_SIZE) {
    errors.push(`"gridSize" must be an integer between 1 and ${MAX_GRID_SIZE}.`);
  } else {
    gridSize = input.gridSize;
  }

  // When gridSize is invalid we still parse the arrays (to surface their errors too),
  // using a permissive bound so we don't emit misleading "out of grid" noise.
  const bound = gridSize >= 1 ? gridSize : Number.MAX_SAFE_INTEGER;

  const walkers = parsePositions(input.walkers, "walkers", bound, errors);
  const labSurvivors = parsePositions(input.labSurvivors, "labSurvivors", bound, errors);
  const precinctSurvivors = parsePositions(input.precinctSurvivors, "precinctSurvivors", bound, errors);
  const resources = parsePositions(input.resources, "resources", bound, errors);

  if (resources.length === 0) {
    errors.push("A scenario needs at least one resource to compete for.");
  }
  if (labSurvivors.length + precinctSurvivors.length === 0) {
    errors.push("A scenario needs at least one survivor (Lab or Precinct).");
  }

  // One-mobile-per-cell must hold from turn 0: no two mobile entities may share a start cell.
  const mobileCells = new Map<string, string>();
  const checkMobileOverlap = (list: readonly Position[], label: string): void => {
    list.forEach((p, i) => {
      const key = positionKey(p);
      const existing = mobileCells.get(key);
      if (existing !== undefined) {
        errors.push(`Two mobile entities start on cell (${p.x}, ${p.y}): ${existing} and ${label}[${i}].`);
      } else {
        mobileCells.set(key, `${label}[${i}]`);
      }
    });
  };
  checkMobileOverlap(walkers, "walkers");
  checkMobileOverlap(labSurvivors, "labSurvivors");
  checkMobileOverlap(precinctSurvivors, "precinctSurvivors");

  // Resources occupy distinct cells (mobiles may start on a resource — that's a different layer).
  const resourceCells = new Set<string>();
  resources.forEach((p, i) => {
    const key = positionKey(p);
    if (resourceCells.has(key)) {
      errors.push(`Two resources start on the same cell (${p.x}, ${p.y}) at resources[${i}].`);
    } else {
      resourceCells.add(key);
    }
  });

  let seed = DEFAULT_SEED;
  if (input.seed !== undefined) {
    if (!isInteger(input.seed)) {
      errors.push(`"seed" must be an integer.`);
    } else {
      seed = input.seed;
    }
  }

  const config = parseConfig(input.config, gridSize >= 1 ? gridSize : 1, errors);

  const name =
    typeof input.name === "string" && input.name.trim() !== "" ? input.name : "scenario";

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: { name, gridSize, seed, walkers, labSurvivors, precinctSurvivors, resources, config },
  };
}
