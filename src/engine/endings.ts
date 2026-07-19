import type { SimulationState } from "./state.js";
import type { Faction } from "../domain/entities.js";

export type Winner = Faction | "walkers" | "draw";
export type EndReason = "all-resources-claimed" | "no-survivors" | "turn-cap" | "stalemate";

export type Outcome = { readonly ended: false } | { readonly ended: true; readonly reason: EndReason };

function survivorsOf(state: SimulationState, faction: Faction): number {
  return state.survivors.filter((survivor) => survivor.faction === faction).length;
}

/**
 * Decide whether the run has ended, checked at the end of each turn. Order matters:
 *
 * 1. No survivors → the dead have won (this outranks "all resources claimed": if the last
 *    resource is grabbed and then everyone is killed in the same turn, no one escaped).
 * 2. All resources claimed → the surviving groups are scored.
 * 3. Turn cap reached → hard termination guarantee.
 * 4. No progress this turn → a frozen, deterministic board; stop rather than idle to the cap.
 */
export function checkEnd(state: SimulationState, progressedThisTurn: boolean): Outcome {
  if (state.survivors.length === 0) return { ended: true, reason: "no-survivors" };
  if (state.resources.length === 0) return { ended: true, reason: "all-resources-claimed" };
  if (state.turn >= state.config.maxTurns) return { ended: true, reason: "turn-cap" };
  if (!progressedThisTurn) return { ended: true, reason: "stalemate" };
  return { ended: false };
}

/**
 * The winner: most resources wins; a resource tie is broken by survivors remaining; a
 * still-even result is an honest draw. If no human is left alive, the walkers win outright.
 */
export function determineWinner(state: SimulationState): Winner {
  const labAlive = survivorsOf(state, "lab");
  const precinctAlive = survivorsOf(state, "precinct");
  if (labAlive + precinctAlive === 0) return "walkers";

  const lab = state.claimed.lab;
  const precinct = state.claimed.precinct;
  if (lab > precinct) return "lab";
  if (precinct > lab) return "precinct";

  if (labAlive > precinctAlive) return "lab";
  if (precinctAlive > labAlive) return "precinct";
  return "draw";
}
