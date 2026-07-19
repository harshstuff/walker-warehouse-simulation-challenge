import type { Scenario } from "../domain/scenario.js";
import type { Entity, Faction } from "../domain/entities.js";
import { createInitialState, snapshot } from "./state.js";
import { executeTurn } from "./turn.js";
import { checkEnd, determineWinner, type Winner, type EndReason } from "./endings.js";
import type { SimEvent } from "./events.js";

export interface TurnLog {
  readonly turn: number;
  readonly events: readonly SimEvent[];
  /** Every living entity's position at the end of the turn, for rendering. */
  readonly entities: readonly Entity[];
}

export interface SimulationResult {
  readonly scenario: Scenario;
  readonly winner: Winner;
  readonly endReason: EndReason;
  readonly turns: number;
  readonly claimed: Readonly<Record<Faction, number>>;
  readonly survivorsRemaining: Readonly<Record<Faction, number>>;
  readonly totalResources: number;
  readonly initialEntities: readonly Entity[];
  readonly turnLogs: readonly TurnLog[];
}

/**
 * The pure heart of the program: a validated Scenario in, a full SimulationResult out.
 * Deterministic by construction — the only randomness is the seeded RNG created from
 * `scenario.seed`, so the same input always produces the same run.
 */
export function runSimulation(scenario: Scenario): SimulationResult {
  const state = createInitialState(scenario);
  const totalResources = state.resources.length;
  const initialEntities = snapshot(state);
  const turnLogs: TurnLog[] = [];

  let outcome = checkEnd(state, true);
  while (!outcome.ended) {
    const { events, progressed } = executeTurn(state);
    turnLogs.push({ turn: state.turn, events, entities: snapshot(state) });
    outcome = checkEnd(state, progressed);
  }

  return {
    scenario,
    winner: determineWinner(state),
    endReason: outcome.reason,
    turns: state.turn,
    claimed: { ...state.claimed },
    survivorsRemaining: {
      lab: state.survivors.filter((s) => s.faction === "lab").length,
      precinct: state.survivors.filter((s) => s.faction === "precinct").length,
    },
    totalResources,
    initialEntities,
    turnLogs,
  };
}
