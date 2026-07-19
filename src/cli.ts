#!/usr/bin/env node
/**
 * CLI entry point for the warehouse simulation.
 *
 * Reads a scenario file, parses and validates it at the boundary, then runs the
 * deterministic simulation and prints the full play-by-play and verdict. Validation
 * problems are reported together and the process exits non-zero.
 */
import { readFileSync } from "node:fs";
import { validateScenario } from "./io/validation.js";
import { runSimulation } from "./engine/simulation.js";
import { buildReport } from "./io/report.js";

const scenarioPath = process.argv[2];

if (!scenarioPath) {
  console.error("Usage: npm run simulate -- <path-to-scenario.json>");
  process.exit(1);
}

let raw: unknown;
try {
  raw = JSON.parse(readFileSync(scenarioPath, "utf8"));
} catch (err) {
  console.error(`Failed to read scenario "${scenarioPath}": ${(err as Error).message}`);
  process.exit(1);
}

const validation = validateScenario(raw);

if (!validation.ok) {
  console.error(`Invalid scenario "${scenarioPath}":`);
  for (const error of validation.errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

const result = runSimulation(validation.value);
console.log(buildReport(result));
