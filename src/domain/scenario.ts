import type { Position } from "./position.js";
import type { SimulationConfig } from "./config.js";

/**
 * A fully-specified, validated simulation input. Everything optional in the raw JSON
 * (name, seed, config) has been resolved to a concrete value by the time a Scenario
 * exists — so the engine never has to reason about "maybe missing" fields. Producing one
 * is the job of the validation layer (src/io/validation.ts); the engine only ever sees
 * a Scenario it can trust.
 */
export interface Scenario {
  readonly name: string;
  readonly gridSize: number;
  readonly seed: number;
  readonly walkers: readonly Position[];
  readonly labSurvivors: readonly Position[];
  readonly precinctSurvivors: readonly Position[];
  readonly resources: readonly Position[];
  readonly config: SimulationConfig;
}
