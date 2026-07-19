import type { SimulationResult } from "../engine/simulation.js";
import type { SimEvent } from "../engine/events.js";
import type { Winner, EndReason } from "../engine/endings.js";
import type { Faction } from "../domain/entities.js";
import { renderGrid, MAX_RENDER_SIZE, LEGEND } from "./render.js";

/** Beyond this many turns we stop drawing a grid per turn and keep only the narration. */
const MAX_RENDERED_TURNS = 60;

function group(faction: Faction): string {
  return faction === "lab" ? "Lab" : "Precinct";
}

function narrate(event: SimEvent): string {
  if (event.kind === "claim") {
    return `    📦 ${group(event.faction)} ${event.survivorId} claims a resource at (${event.at.x}, ${event.at.y}) — Lab ${event.labTotal}, Precinct ${event.precinctTotal}.`;
  }
  const who = `${group(event.faction)} ${event.survivorId}`;
  const where = `(${event.at.x}, ${event.at.y})`;
  return event.survivorWon
    ? `    🔪 ${who} puts down walker ${event.walkerId} at ${where}.`
    : `    💀 ${who} is dragged down by walker ${event.walkerId} at ${where} and rises no more.`;
}

function reasonText(reason: EndReason): string {
  switch (reason) {
    case "all-resources-claimed":
      return "every resource has been claimed";
    case "no-survivors":
      return "no survivors remain";
    case "turn-cap":
      return "the turn limit was reached";
    case "stalemate":
      return "the board reached a standstill";
  }
}

function verdict(winner: Winner): string {
  switch (winner) {
    case "lab":
      return "🧪 THE LAB WINS — the research lives to see another day.";
    case "precinct":
      return "🚓 THE PRECINCT WINS — the officers hold the line and haul off the supplies.";
    case "walkers":
      return "🧟 THE DEAD WIN — no one walks out of the warehouse.";
    case "draw":
      return "⚖️  A DRAW — both groups bleed even, and the warehouse keeps its spoils.";
  }
}

/**
 * Build the full, human-readable account of a run: a header, the opening board, a
 * turn-by-turn narration (with the grid where it's small enough to be useful), and the
 * closing verdict. This is the "enough information to understand how it played out" the
 * brief asks for.
 */
export function buildReport(result: SimulationResult): string {
  const { scenario } = result;
  const out: string[] = [];

  out.push(`=== ${scenario.name} ===`);
  out.push(
    `Grid ${scenario.gridSize}×${scenario.gridSize}, seed ${scenario.seed}. ` +
      `Lab (win ${scenario.config.combatWinChance.lab}) vs Precinct (win ${scenario.config.combatWinChance.precinct}). ` +
      `${result.totalResources} resource(s), ${scenario.walkers.length} walker(s).`,
  );
  out.push(LEGEND);
  out.push("");

  const drawGrids = scenario.gridSize <= MAX_RENDER_SIZE && result.turnLogs.length <= MAX_RENDERED_TURNS;

  out.push("Turn 0 — the warehouse, before anyone moves:");
  out.push(renderGrid(result.initialEntities, scenario.gridSize));
  out.push("");

  for (const log of result.turnLogs) {
    out.push(`Turn ${log.turn}:`);
    if (log.events.length === 0) {
      out.push("    · survivors and walkers reposition.");
    } else {
      for (const event of log.events) out.push(narrate(event));
    }
    if (drawGrids) {
      out.push(renderGrid(log.entities, scenario.gridSize));
    }
    out.push("");
  }

  if (!drawGrids) {
    out.push("Final board:");
    const last = result.turnLogs[result.turnLogs.length - 1];
    if (last) out.push(renderGrid(last.entities, scenario.gridSize));
    out.push("");
  }

  out.push("=== OUTCOME ===");
  out.push(verdict(result.winner));
  out.push(`Reason: ${reasonText(result.endReason)} after ${result.turns} turn(s).`);
  out.push(
    `Resources claimed — Lab ${result.claimed.lab}, Precinct ${result.claimed.precinct} (of ${result.totalResources}).`,
  );
  out.push(
    `Survivors remaining — Lab ${result.survivorsRemaining.lab}, Precinct ${result.survivorsRemaining.precinct}.`,
  );

  return out.join("\n");
}
