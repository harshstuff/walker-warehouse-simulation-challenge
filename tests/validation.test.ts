import { describe, it, expect } from "vitest";
import { validateScenario } from "../src/io/validation.js";

/** A minimal, valid scenario used as the baseline for override/failure cases. */
const valid = {
  name: "unit",
  gridSize: 5,
  seed: 42,
  walkers: [{ x: 2, y: 2 }],
  labSurvivors: [{ x: 0, y: 0 }],
  precinctSurvivors: [{ x: 4, y: 4 }],
  resources: [{ x: 1, y: 1 }],
};

describe("validateScenario — happy path", () => {
  it("accepts a valid scenario and fills defaults", () => {
    const result = validateScenario(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe("unit");
    expect(result.value.seed).toBe(42);
    expect(result.value.config.maxTurns).toBe(4 * 5 * 5); // default 4·N²
    expect(result.value.config.combatWinChance).toEqual({ lab: 0.4, precinct: 0.6 });
  });

  it("defaults seed and name when omitted", () => {
    const { seed: _seed, name: _name, ...rest } = valid;
    const result = validateScenario(rest);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.seed).toBe(1);
    expect(result.value.name).toBe("scenario");
  });

  it("applies config overrides", () => {
    const result = validateScenario({
      ...valid,
      config: { combatWinChance: { lab: 0.5 }, maxTurns: 30 },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.config.combatWinChance).toEqual({ lab: 0.5, precinct: 0.6 });
    expect(result.value.config.maxTurns).toBe(30);
  });

  it("allows a survivor to start on a resource cell (different layers)", () => {
    const result = validateScenario({
      ...valid,
      labSurvivors: [{ x: 1, y: 1 }], // same cell as the resource
    });
    expect(result.ok).toBe(true);
  });
});

describe("validateScenario — rejections", () => {
  it("rejects non-object input", () => {
    expect(validateScenario(null).ok).toBe(false);
    expect(validateScenario(42).ok).toBe(false);
  });

  it("rejects a bad grid size", () => {
    const result = validateScenario({ ...valid, gridSize: 0 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.includes("gridSize"))).toBe(true);
  });

  it("rejects an out-of-bounds position", () => {
    const result = validateScenario({ ...valid, walkers: [{ x: 5, y: 0 }] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.includes("outside"))).toBe(true);
  });

  it("rejects two mobile entities on the same start cell", () => {
    const result = validateScenario({
      ...valid,
      walkers: [{ x: 0, y: 0 }], // collides with labSurvivors[0]
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.includes("Two mobile entities"))).toBe(true);
  });

  it("rejects duplicate resource cells", () => {
    const result = validateScenario({
      ...valid,
      resources: [{ x: 1, y: 1 }, { x: 1, y: 1 }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.includes("Two resources"))).toBe(true);
  });

  it("requires at least one resource and one survivor", () => {
    const noResources = validateScenario({ ...valid, resources: [] });
    const noSurvivors = validateScenario({ ...valid, labSurvivors: [], precinctSurvivors: [] });
    expect(noResources.ok).toBe(false);
    expect(noSurvivors.ok).toBe(false);
  });

  it("rejects combat odds outside [0, 1]", () => {
    const result = validateScenario({ ...valid, config: { combatWinChance: { precinct: 1.5 } } });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.includes("combatWinChance"))).toBe(true);
  });

  it("accumulates multiple errors at once", () => {
    const result = validateScenario({ gridSize: -1, walkers: "nope", resources: [] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.length).toBeGreaterThan(1);
  });
});
