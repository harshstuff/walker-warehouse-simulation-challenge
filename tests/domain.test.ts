import { describe, it, expect } from "vitest";
import {
  manhattanDistance,
  samePosition,
  comparePositions,
  positionKey,
  createRng,
  chance,
  isWalker,
  isSurvivor,
  isResource,
  isMobile,
  areCombatants,
  type Entity,
  type MobileEntity,
} from "../src/domain/index.js";

describe("position primitives", () => {
  it("measures Manhattan distance as |dx| + |dy|", () => {
    expect(manhattanDistance({ x: 0, y: 0 }, { x: 2, y: 3 })).toBe(5);
    expect(manhattanDistance({ x: 4, y: 1 }, { x: 4, y: 1 })).toBe(0);
  });

  it("compares cells by x then y (the tie-break rule)", () => {
    expect(comparePositions({ x: 1, y: 9 }, { x: 2, y: 0 })).toBeLessThan(0); // lower x wins
    expect(comparePositions({ x: 3, y: 1 }, { x: 3, y: 4 })).toBeLessThan(0); // same x, lower y wins
    expect(comparePositions({ x: 3, y: 4 }, { x: 3, y: 4 })).toBe(0);
  });

  it("detects same cell and builds a stable key", () => {
    expect(samePosition({ x: 2, y: 2 }, { x: 2, y: 2 })).toBe(true);
    expect(samePosition({ x: 2, y: 2 }, { x: 2, y: 3 })).toBe(false);
    expect(positionKey({ x: 5, y: 7 })).toBe("5,7");
  });
});

describe("seeded rng", () => {
  it("is deterministic: same seed → identical stream", () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];
    expect(seqA).toEqual(seqB);
  });

  it("produces different streams for different seeds", () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it("returns floats in [0, 1)", () => {
    const rng = createRng(12345);
    for (let i = 0; i < 100; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("chance() is reproducible for a given seed", () => {
    const draw = (): boolean[] => {
      const rng = createRng(7);
      return [chance(rng, 0.6), chance(rng, 0.6), chance(rng, 0.6)];
    };
    expect(draw()).toEqual(draw());
  });
});

describe("entity guards", () => {
  const walker: Entity = { kind: "walker", id: "walker-0", position: { x: 0, y: 0 } };
  const survivor: Entity = { kind: "survivor", id: "lab-0", faction: "lab", position: { x: 1, y: 1 } };
  const resource: Entity = { kind: "resource", id: "resource-0", position: { x: 2, y: 2 } };

  it("narrows each entity kind", () => {
    expect(isWalker(walker)).toBe(true);
    expect(isSurvivor(survivor)).toBe(true);
    expect(isResource(resource)).toBe(true);
    expect(isMobile(walker)).toBe(true);
    expect(isMobile(survivor)).toBe(true);
    expect(isMobile(resource)).toBe(false);
  });

  it("treats only survivor-vs-walker as a combat pair", () => {
    const walkerB: MobileEntity = { kind: "walker", id: "walker-1", position: { x: 3, y: 3 } };
    const precinct: MobileEntity = { kind: "survivor", id: "precinct-0", faction: "precinct", position: { x: 4, y: 4 } };
    expect(areCombatants(walker, survivor)).toBe(true); // survivor ↔ walker → fight
    expect(areCombatants(walker, walkerB)).toBe(false); // walker + walker → block
    expect(areCombatants(survivor, precinct)).toBe(false); // rival survivors (v1) → block
  });
});
