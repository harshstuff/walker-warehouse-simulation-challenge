import type { Scenario } from "../domain/scenario.js";
import type { SimulationConfig } from "../domain/config.js";
import type { Walker, Survivor, Resource, MobileEntity, Entity, Faction } from "../domain/entities.js";
import type { Position } from "../domain/position.js";
import { positionKey } from "../domain/position.js";
import type { Rng } from "../domain/rng.js";
import { createRng } from "../domain/rng.js";

/**
 * The mutable working state of a single run. It is created from a Scenario, mutated turn
 * by turn, and never escapes the engine — `runSimulation` is pure from the outside even
 * though it drives controlled mutation inside (which reads far more naturally for a
 * turn-based simulation than threading a new immutable snapshot through every step).
 *
 * Two indexes are kept in sync with the entity lists so movement and interaction lookups
 * are O(1): `mobileAt` (the one-mobile-per-cell invariant) and `resourceAt`.
 */
export interface SimulationState {
  readonly gridSize: number;
  readonly config: SimulationConfig;
  readonly rng: Rng;
  turn: number;
  walkers: Walker[];
  survivors: Survivor[];
  resources: Resource[];
  readonly claimed: Record<Faction, number>;
  readonly mobileAt: Map<string, MobileEntity>;
  readonly resourceAt: Map<string, Resource>;
}

export function createInitialState(scenario: Scenario): SimulationState {
  const walkers: Walker[] = scenario.walkers.map((position, i) => ({
    kind: "walker",
    id: `walker-${i}`,
    position,
  }));
  const labSurvivors: Survivor[] = scenario.labSurvivors.map((position, i) => ({
    kind: "survivor",
    id: `lab-${i}`,
    faction: "lab",
    position,
  }));
  const precinctSurvivors: Survivor[] = scenario.precinctSurvivors.map((position, i) => ({
    kind: "survivor",
    id: `precinct-${i}`,
    faction: "precinct",
    position,
  }));
  const resources: Resource[] = scenario.resources.map((position, i) => ({
    kind: "resource",
    id: `resource-${i}`,
    position,
  }));

  const survivors = [...labSurvivors, ...precinctSurvivors];

  const mobileAt = new Map<string, MobileEntity>();
  for (const mobile of [...walkers, ...survivors]) {
    mobileAt.set(positionKey(mobile.position), mobile);
  }
  const resourceAt = new Map<string, Resource>();
  for (const resource of resources) {
    resourceAt.set(positionKey(resource.position), resource);
  }

  return {
    gridSize: scenario.gridSize,
    config: scenario.config,
    rng: createRng(scenario.seed),
    turn: 0,
    walkers,
    survivors,
    resources,
    claimed: { lab: 0, precinct: 0 },
    mobileAt,
    resourceAt,
  };
}

function replaceById<T extends { readonly id: string }>(list: T[], next: T): void {
  const index = list.findIndex((entity) => entity.id === next.id);
  if (index >= 0) list[index] = next;
}

/** Move a mobile entity to `to`, keeping the occupancy index in sync. Caller guarantees `to` is free. */
export function moveMobile(state: SimulationState, entity: MobileEntity, to: Position): void {
  state.mobileAt.delete(positionKey(entity.position));
  if (entity.kind === "walker") {
    const moved: Walker = { ...entity, position: to };
    replaceById(state.walkers, moved);
    state.mobileAt.set(positionKey(to), moved);
  } else {
    const moved: Survivor = { ...entity, position: to };
    replaceById(state.survivors, moved);
    state.mobileAt.set(positionKey(to), moved);
  }
}

/** Remove a dead mobile entity from the board and the occupancy index. */
export function removeMobile(state: SimulationState, entity: MobileEntity): void {
  state.mobileAt.delete(positionKey(entity.position));
  if (entity.kind === "walker") {
    state.walkers = state.walkers.filter((walker) => walker.id !== entity.id);
  } else {
    state.survivors = state.survivors.filter((survivor) => survivor.id !== entity.id);
  }
}

/** Claim a resource for a faction: remove it from the board and increment the group's score. */
export function claimResource(state: SimulationState, resource: Resource, faction: Faction): void {
  state.resourceAt.delete(positionKey(resource.position));
  state.resources = state.resources.filter((r) => r.id !== resource.id);
  state.claimed[faction] += 1;
}

/** A shallow copy of every living entity's current state, for a turn's grid snapshot. */
export function snapshot(state: SimulationState): Entity[] {
  return [...state.walkers, ...state.survivors, ...state.resources];
}
