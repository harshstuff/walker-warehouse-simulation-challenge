/**
 * The domain layer: the pure vocabulary of the simulation — entities, positions, config,
 * and the seeded RNG. It has no I/O and no engine logic, so everything here is trivially
 * testable and safe to depend on from any other layer.
 */
export * from "./position.js";
export * from "./entities.js";
export * from "./config.js";
export * from "./scenario.js";
export * from "./rng.js";
