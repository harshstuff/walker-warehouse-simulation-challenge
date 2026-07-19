import type { Survivor } from "../domain/entities.js";
import type { SimulationConfig } from "../domain/config.js";
import type { Rng } from "../domain/rng.js";
import { chance } from "../domain/rng.js";

/**
 * Resolve a survivor-vs-walker fight with a single seeded coin. Returns true if the
 * survivor wins (and the walker dies), false if the survivor dies.
 *
 * The odds depend only on the survivor's faction — and crucially, not on who initiated
 * the fight — so a walker lunging at a survivor and a survivor charging a walker are the
 * same gamble. This is the one place the Lab/Precinct asymmetry lives.
 */
export function survivorWinsFight(survivor: Survivor, config: SimulationConfig, rng: Rng): boolean {
  return chance(rng, config.combatWinChance[survivor.faction]);
}
