import type { Faction } from "./entities.js";

/**
 * Tunable simulation parameters. Every field has a sensible default (see below), so a
 * scenario file only needs to override what it actually cares about. Keeping these in the
 * domain — rather than as magic numbers in the engine — is what makes the balance legible
 * and defensible.
 */
export interface SimulationConfig {
  /**
   * Probability in [0, 1] that a survivor of each faction WINS a fight against a walker.
   * The walker wins the complement. This is the only mechanical difference between the two
   * groups, so it carries all of the lore-driven asymmetry.
   */
  readonly combatWinChance: Readonly<Record<Faction, number>>;
  /** Hard cap on turns — guarantees termination even on a stalemate board. */
  readonly maxTurns: number;
}

/**
 * Precinct officers are trained and win most fights; the Lab are researchers who fight
 * poorly — but their number is lifted by desperation/adrenaline (per the backstory),
 * which is why it's 0.4 rather than an instinctive 0.25.
 */
export const DEFAULT_COMBAT_WIN_CHANCE: Readonly<Record<Faction, number>> = {
  precinct: 0.6,
  lab: 0.4,
};

/**
 * Default turn cap. Scales with grid area so larger floors get proportionally more time
 * for any reachable resource to be claimed before the stalemate guard trips.
 */
export function defaultMaxTurns(gridSize: number): number {
  return 4 * gridSize * gridSize;
}
