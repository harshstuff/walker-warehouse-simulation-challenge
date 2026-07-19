import type { Position } from "./position.js";

/** The two survivor groups competing for the warehouse resources. */
export type Faction = "lab" | "precinct";

/** Discriminant shared by every entity that can occupy the grid. */
export type EntityKind = "walker" | "survivor" | "resource";

interface EntityBase {
  /** Stable identity for the lifetime of a run (e.g. "lab-0", "walker-2"). Used for logging. */
  readonly id: string;
  readonly position: Position;
}

/** A walker — hunts the nearest survivor and never claims resources. */
export interface Walker extends EntityBase {
  readonly kind: "walker";
}

/** A survivor from one of the two groups, racing to claim resources. */
export interface Survivor extends EntityBase {
  readonly kind: "survivor";
  readonly faction: Faction;
}

/** A resource on the floor — static, and claimed on contact by a surviving survivor. */
export interface Resource extends EntityBase {
  readonly kind: "resource";
}

/** Every entity the world can hold. A discriminated union so `kind` drives exhaustive handling. */
export type Entity = Walker | Survivor | Resource;

/** The entities that take an action each turn. Resources are excluded — they never move. */
export type MobileEntity = Walker | Survivor;

export function isWalker(entity: Entity): entity is Walker {
  return entity.kind === "walker";
}

export function isSurvivor(entity: Entity): entity is Survivor {
  return entity.kind === "survivor";
}

export function isResource(entity: Entity): entity is Resource {
  return entity.kind === "resource";
}

export function isMobile(entity: Entity): entity is MobileEntity {
  return entity.kind === "walker" || entity.kind === "survivor";
}

/**
 * A survivor and a walker are the only pair that resolves by combat; every other pairing
 * of mobile entities (same-group survivors, rival survivors in v1, walker-on-walker) is a
 * non-combat pair and simply blocks movement. Centralising the rule here keeps the
 * interaction layer honest about the one-mobile-per-cell invariant.
 */
export function areCombatants(a: MobileEntity, b: MobileEntity): boolean {
  return a.kind !== b.kind;
}
