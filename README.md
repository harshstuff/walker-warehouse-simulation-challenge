# Walker Warehouse Simulation

A small "what if?" engine for *The Walking Dead* franchise. Two survivor groups —
**The Lab** (medical researchers, forced to scavenge after a fire destroyed their
supplies) and **The Precinct** (a handful of trained officers, all that's left after
their shelter fell) — arrive at the same walker-infested warehouse and race to claim the
resources scattered across the floor, while the dead hunt them.

The simulation is a deterministic, seeded turn engine over an N×N grid: the same scenario
and seed always produce the same run, so every "what if?" is reproducible and explainable.

## How it works (in one breath)

Each turn, every living entity acts once. Survivors beeline (4-directionally) toward the
nearest resource; walkers always chase the nearest survivor. A survivor stepping onto a
walker (or vice versa) fights — one seeded coin, loser dies, and the **Precinct win 60%**
of fights to the **Lab's 40%** (trained officers vs. desperate researchers; the only
mechanical difference between the groups). Combat resolves before a resource is claimed.
Only one mobile entity occupies a cell at a time, so a blocked mover simply waits. The run
ends when all resources are claimed, no survivors remain, a turn cap is hit, or the board
freezes — and the group with the most resources wins.

The full reasoning behind every rule is in [docs/DESIGN.md](docs/DESIGN.md); the decision
log with rationale is in [docs/DECISIONS.md](docs/DECISIONS.md).

## Requirements

- **Node.js 24 (LTS "Krypton")** — pinned in [`.nvmrc`](.nvmrc).
- No other system dependencies. No Docker: this is a single, dependency-free program.

## Setup

```bash
nvm use        # switches to the Node version in .nvmrc (nvm install if needed)
npm install    # dev dependencies only — zero runtime dependencies
```

## Build

```bash
npm run build      # compile TypeScript to dist/
npm run typecheck  # type-check without emitting
```

## Run

Scenarios are plain JSON files (see [`scenarios/`](scenarios/)). Pass one to the CLI:

```bash
npm run simulate -- scenarios/close-race.json   # run from source (tsx)

# or, after building:
npm run build
npm start scenarios/close-race.json
```

The program validates the scenario (reporting all problems at once and exiting non-zero if
invalid), then prints a turn-by-turn account and the final verdict.

## Test

```bash
npm test           # run once
npm run test:watch # watch mode
```

## Scenario format

```jsonc
{
  "name": "close-race",          // optional label (default: "scenario")
  "gridSize": 8,                  // required: N for the N×N grid (1–1000)
  "seed": 42,                     // optional integer (default: 1) — controls all randomness
  "walkers":           [{ "x": 4, "y": 4 }],
  "labSurvivors":      [{ "x": 0, "y": 0 }],
  "precinctSurvivors": [{ "x": 7, "y": 7 }],
  "resources":         [{ "x": 3, "y": 4 }],
  "config": {                     // optional; omit to use the defaults below
    "combatWinChance": { "lab": 0.4, "precinct": 0.6 },
    "maxTurns": 256               // default: 4 × gridSize²
  }
}
```

Rules the validator enforces:

- All four entity arrays (`walkers`, `labSurvivors`, `precinctSurvivors`, `resources`)
  must be **present** — use `[]` for a group you don't want, not a missing key.
- Positions are zero-indexed integers within the grid; `(0,0)` is the top-left.
- No two **mobile** entities may share a starting cell; resource cells must be distinct.
  (A survivor or walker *may* start on a resource cell.)
- A scenario needs at least one resource and at least one survivor.
- `combatWinChance` values are in `[0, 1]`; `maxTurns` is a positive integer.

## Output

The grid is drawn with:

```
Z = walker   L = Lab   P = Precinct   * = resource   . = empty
```

Each turn narrates the dramatic beats — 📦 a claim, 🔪 a walker cut down, 💀 a survivor
lost — followed by the board. The run closes with the winner and the reason it ended
(*all resources claimed*, *no survivors*, *turn cap*, or *stalemate*). Winner is decided
by resources claimed, ties broken by survivors remaining, then an honest draw; if no human
survives, the dead win. (Per-turn grids are omitted for very large grids or very long runs
to keep the output readable.)

## Project layout

```
.nvmrc                 Node version pin (24 LTS)
package.json           Scripts + dev deps (no runtime deps)
tsconfig.json          Strict TypeScript config
vitest.config.ts       Test config
src/
  domain/              Pure model — entities, positions, config, seeded RNG, scenario type
  io/                  Boundary — validation, ASCII render, dramatic report
  engine/              Pure simulation — state, movement, interactions, turn, endings, run loop
  cli.ts               Entry point — validate → simulate → report
scenarios/             Example scenario inputs (close-race, walker-heavy)
tests/                 Vitest suites — domain, validation, engine, smoke
docs/
  DESIGN.md            Design walkthrough (assumptions, trade-offs)
  DECISIONS.md         Decision log with rationale
```
