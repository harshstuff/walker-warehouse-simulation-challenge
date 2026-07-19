import type { SimulationState } from "./state.js";
import { moveMobile, removeMobile, claimResource } from "./state.js";
import type { SimEvent } from "./events.js";
import type { Survivor, Walker } from "../domain/entities.js";
import { positionKey } from "../domain/position.js";
import { stepToward, nearest } from "./movement.js";
import { survivorWinsFight } from "./interactions.js";

export interface TurnResult {
  readonly events: SimEvent[];
  /** True if anything actually happened (a move, claim, or fight). A turn with none is a stalemate. */
  readonly progressed: boolean;
}

/** Survivor processing order: Lab first on odd turns, Precinct first on even. Input order within each. */
function survivorSchedule(state: SimulationState, turn: number): string[] {
  const lab = state.survivors.filter((s) => s.faction === "lab").map((s) => s.id);
  const precinct = state.survivors.filter((s) => s.faction === "precinct").map((s) => s.id);
  return turn % 2 === 1 ? [...lab, ...precinct] : [...precinct, ...lab];
}

function recordClaim(state: SimulationState, survivor: Survivor, events: SimEvent[]): void {
  events.push({
    kind: "claim",
    survivorId: survivor.id,
    faction: survivor.faction,
    at: survivor.position,
    labTotal: state.claimed.lab,
    precinctTotal: state.claimed.precinct,
  });
}

/** Activate one survivor. Returns true if it made progress (claimed, moved, or fought). */
function activateSurvivor(state: SimulationState, survivor: Survivor, events: SimEvent[]): boolean {
  // Claim the resource under your feet first (covers a survivor that started on one).
  const here = state.resourceAt.get(positionKey(survivor.position));
  if (here) {
    claimResource(state, here, survivor.faction);
    recordClaim(state, survivor, events);
    return true;
  }

  const target = nearest(survivor.position, state.resources);
  if (target === undefined) return false; // nothing left to chase (the run is about to end)

  const to = stepToward(survivor.position, target.position);
  const occupant = state.mobileAt.get(positionKey(to));

  if (occupant === undefined) {
    moveMobile(state, survivor, to);
    const arrivedOn = state.resourceAt.get(positionKey(to));
    if (arrivedOn) {
      claimResource(state, arrivedOn, survivor.faction);
      // re-read the moved survivor's position for the event (it now sits on `to`)
      recordClaim(state, { ...survivor, position: to }, events);
    }
    return true;
  }

  if (occupant.kind === "walker") {
    const won = survivorWinsFight(survivor, state.config, state.rng);
    events.push({
      kind: "combat",
      survivorId: survivor.id,
      faction: survivor.faction,
      walkerId: occupant.id,
      at: to,
      survivorWon: won,
    });
    if (won) {
      removeMobile(state, occupant);
      moveMobile(state, survivor, to);
      const arrivedOn = state.resourceAt.get(positionKey(to));
      if (arrivedOn) {
        claimResource(state, arrivedOn, survivor.faction);
        recordClaim(state, { ...survivor, position: to }, events);
      }
    } else {
      removeMobile(state, survivor);
    }
    return true;
  }

  // Occupant is a friendly or rival survivor — a non-combat pair. Blocked: wait this turn.
  return false;
}

/** Activate one walker. Returns true if it made progress (moved or fought). */
function activateWalker(state: SimulationState, walker: Walker, events: SimEvent[]): boolean {
  const target = nearest(walker.position, state.survivors);
  if (target === undefined) return false; // no prey left

  const to = stepToward(walker.position, target.position);
  const occupant = state.mobileAt.get(positionKey(to));

  if (occupant === undefined) {
    moveMobile(state, walker, to); // walkers ignore resources
    return true;
  }

  if (occupant.kind === "survivor") {
    const won = survivorWinsFight(occupant, state.config, state.rng);
    events.push({
      kind: "combat",
      survivorId: occupant.id,
      faction: occupant.faction,
      walkerId: walker.id,
      at: to,
      survivorWon: won,
    });
    if (won) {
      removeMobile(state, walker);
    } else {
      removeMobile(state, occupant);
      moveMobile(state, walker, to);
    }
    return true;
  }

  // Occupant is another walker — blocked, wait.
  return false;
}

/**
 * Run one full turn: every living survivor acts (in initiative order), then every walker.
 * Entities are looked up by id at activation time so that anything killed earlier in the
 * turn is skipped and anything that moved is acted on at its current position.
 */
export function executeTurn(state: SimulationState): TurnResult {
  state.turn += 1;
  const events: SimEvent[] = [];
  let progressed = false;

  for (const id of survivorSchedule(state, state.turn)) {
    const current = state.survivors.find((s) => s.id === id);
    if (current === undefined) continue;
    progressed = activateSurvivor(state, current, events) || progressed;
  }

  for (const id of state.walkers.map((w) => w.id)) {
    const current = state.walkers.find((w) => w.id === id);
    if (current === undefined) continue;
    progressed = activateWalker(state, current, events) || progressed;
  }

  return { events, progressed };
}
