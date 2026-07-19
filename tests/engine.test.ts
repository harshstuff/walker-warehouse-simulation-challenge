import { describe, it, expect } from "vitest";
import { stepToward, nearest } from "../src/engine/movement.js";
import { runSimulation } from "../src/engine/simulation.js";
import { validateScenario } from "../src/io/validation.js";

/** Run a raw scenario through the full validate → simulate pipeline (as the CLI does). */
function run(raw: Record<string, unknown>) {
  // The validator requires all four entity arrays to be present, so default the unspecified.
  const full = {
    walkers: [],
    labSurvivors: [],
    precinctSurvivors: [],
    resources: [],
    ...raw,
  };
  const v = validateScenario(full);
  if (!v.ok) throw new Error(`invalid scenario: ${v.errors.join("; ")}`);
  return runSimulation(v.value);
}

describe("movement", () => {
  it("steps one cell toward the target, x-axis first", () => {
    expect(stepToward({ x: 0, y: 0 }, { x: 3, y: 2 })).toEqual({ x: 1, y: 0 });
  });

  it("steps along y only once aligned on x", () => {
    expect(stepToward({ x: 2, y: 0 }, { x: 2, y: 5 })).toEqual({ x: 2, y: 1 });
  });

  it("never moves diagonally", () => {
    expect(stepToward({ x: 4, y: 4 }, { x: 0, y: 0 })).toEqual({ x: 3, y: 4 });
  });

  it("stays put when already on the target", () => {
    expect(stepToward({ x: 1, y: 1 }, { x: 1, y: 1 })).toEqual({ x: 1, y: 1 });
  });

  it("picks the nearest candidate, breaking ties by lower x then y", () => {
    const from = { x: 0, y: 0 };
    const east = { position: { x: 2, y: 0 } };
    const south = { position: { x: 0, y: 2 } };
    expect(nearest(from, [east, south])).toBe(south); // equal distance, (0,2) < (2,0)
  });
});

describe("simulation outcomes", () => {
  it("Lab claims an adjacent resource and wins uncontested", () => {
    const r = run({
      name: "walkover",
      gridSize: 5,
      seed: 1,
      labSurvivors: [{ x: 0, y: 0 }],
      resources: [{ x: 1, y: 0 }],
    });
    expect(r.winner).toBe("lab");
    expect(r.endReason).toBe("all-resources-claimed");
    expect(r.claimed.lab).toBe(1);
  });

  it("claims a resource the survivor starts on, on the first turn", () => {
    const r = run({
      name: "start-on",
      gridSize: 3,
      seed: 1,
      precinctSurvivors: [{ x: 1, y: 1 }],
      resources: [{ x: 1, y: 1 }],
    });
    expect(r.winner).toBe("precinct");
    expect(r.turns).toBe(1);
    expect(r.claimed.precinct).toBe(1);
  });

  it("walkers win when the only survivor is doomed (win chance 0)", () => {
    const r = run({
      name: "doomed",
      gridSize: 5,
      seed: 1,
      labSurvivors: [{ x: 0, y: 0 }],
      walkers: [{ x: 1, y: 0 }],
      resources: [{ x: 4, y: 4 }],
      config: { combatWinChance: { lab: 0 } },
    });
    expect(r.winner).toBe("walkers");
    expect(r.endReason).toBe("no-survivors");
  });

  it("ends in a draw when both groups claim equally and both survive", () => {
    const r = run({
      name: "draw",
      gridSize: 5,
      seed: 1,
      labSurvivors: [{ x: 0, y: 0 }],
      precinctSurvivors: [{ x: 4, y: 4 }],
      resources: [
        { x: 0, y: 1 },
        { x: 4, y: 3 },
      ],
    });
    expect(r.claimed.lab).toBe(1);
    expect(r.claimed.precinct).toBe(1);
    expect(r.winner).toBe("draw");
  });

  it("stops at the turn cap", () => {
    const r = run({
      name: "capped",
      gridSize: 5,
      seed: 1,
      labSurvivors: [{ x: 0, y: 0 }],
      resources: [{ x: 4, y: 4 }],
      config: { maxTurns: 1 },
    });
    expect(r.endReason).toBe("turn-cap");
    expect(r.turns).toBe(1);
  });

  it("is deterministic: same scenario + seed → identical result", () => {
    const raw = {
      name: "close-race",
      gridSize: 8,
      seed: 42,
      walkers: [{ x: 4, y: 4 }],
      labSurvivors: [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
      ],
      precinctSurvivors: [
        { x: 7, y: 7 },
        { x: 7, y: 6 },
      ],
      resources: [
        { x: 3, y: 4 },
        { x: 4, y: 3 },
        { x: 5, y: 4 },
      ],
    };
    const a = run(raw);
    const b = run(raw);
    expect({ winner: a.winner, turns: a.turns, claimed: a.claimed, reason: a.endReason }).toEqual({
      winner: b.winner,
      turns: b.turns,
      claimed: b.claimed,
      reason: b.endReason,
    });
  });

  it("never claims more resources than exist", () => {
    const r = run({
      name: "bounds",
      gridSize: 8,
      seed: 3,
      walkers: [{ x: 4, y: 4 }],
      labSurvivors: [{ x: 0, y: 0 }],
      precinctSurvivors: [{ x: 7, y: 7 }],
      resources: [
        { x: 3, y: 4 },
        { x: 4, y: 3 },
        { x: 5, y: 4 },
      ],
    });
    expect(r.claimed.lab + r.claimed.precinct).toBeLessThanOrEqual(r.totalResources);
  });
});
