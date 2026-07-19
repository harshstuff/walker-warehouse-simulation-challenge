# Design Walkthrough

This document covers the three things the brief asks for:

1. Key assumptions — especially where the spec was ambiguous — and what informed them.
2. One thing I'd improve with more time.
3. One thing I'm most proud of.

---

## 1. Key assumptions and decisions

The brief is deliberately a *design* brief, not a fixed spec. It states outright that
"what activation means, how entities choose where to move, and in what order entities
act" and "how each interaction resolves" are all my decisions. So the assumptions below
are the substance of the submission, not incidental defaults. Where the spec was silent,
the two things that informed each choice were **(a) reproducibility/testability** and
**(b) the lore** — the story is a design input, not decoration.

### Grid and world

- The floor is an N×N grid, zero-indexed, `(0,0)` top-left, x horizontal, y vertical.
- Grid edges are hard walls; no entity can move beyond them.
- Resources are **user-placed and static**. They never move and are not "random" — the
  only randomness in the system is in *behaviour*, and it is seeded (below).

### Entities and activation

- Four entity types: Walkers, Lab survivors, Precinct survivors (all mobile), and
  Resources (static).
- "Activation" = each living entity takes **one action per turn**: a single step toward
  its target, or resolving an interaction on the cell it enters.
- Each group can field multiple survivors. Resources claimed accrue to the **group**, not
  the individual — scoring is group-level.

### Movement and targeting

- Every mobile entity has a **targeting policy**: survivors move toward the nearest
  resource; walkers move toward the nearest survivor.
- Movement geometry: **4-directional** (orthogonal, Manhattan distance) — one step N/S/E/W
  per turn, no diagonals. Distance is `|dx| + |dy|`.
- Walker sensing: walkers **always chase the nearest survivor** (Manhattan distance, same
  x-then-y tiebreak) — no random shambling. A deliberate call to *minimise* randomness:
  with chasing deterministic, combat becomes the only stochastic element, so scenarios stay
  reproducible and the threat stays legible.
- Danger-awareness: v1 survivors are **danger-blind greedy** — they beeline to the nearest
  resource straight through danger. This is dramatic by design (survivors walk into
  walkers); danger-aware routing is deferred (see Section 2).
- Ties are broken by a **deterministic Cartesian rule**: among equidistant targets, pick
  the lowest x then lowest y; when a step could reduce distance on either axis, resolve the
  **x-axis first**, then y. Keeps every run reproducible.

### Turn order and resolution

- Groups act under **alternating initiative** — turn 1 Lab-first, turn 2 Precinct-first,
  alternating by turn parity — so neither side gets a permanent first-mover advantage;
  **walkers act last** each turn. Within a group, survivors act in **input order**.
- Resolution is **sequential**: one entity moves and resolves its interaction before the
  next acts, so every clash is actually recorded (no simultaneous-move paradoxes).
- **At most one mobile entity per cell** (resources are static overlays). Stepping onto a
  combat opponent (survivor↔walker) resolves by combat and the loser is removed; stepping
  onto a non-combat occupant (a friendly, or walker-on-walker) is **blocked** and the mover
  waits. Every interaction is therefore a clean one-vs-one.
- Within a contested cell, **combat resolves before any resource is claimed** — you must
  survive the cell to claim what's on it.

### Interactions (all type combinations)

- **Survivor + Resource** → instant claim on co-location; resource removed, group score +1.
- **Survivor + Walker** → a single **seeded weighted coin**; the loser dies (no HP). Odds
  are **asymmetric by lore**: **Precinct win 60%** of walker fights, **Lab win 40%** — the
  Lab's number reflects desperation/adrenaline, not training. These odds are the *only*
  behavioural difference between the two groups, and are easily tuned.
- **Rival survivor + rival survivor** → **no interaction in v1**; rivals ignore each other,
  and a contested resource goes to whoever acts first (initiative). A non-lethal scuffle is
  a v2 idea.
- **Dead human** → **removed from the board in v1** (no reanimation). Reanimation is v2.
- **Walker + Resource** → **no interaction in v1**; a walker doesn't guard a resource — a
  survivor who wins the cell still claims it. Guarding is v2.
- Same-group co-location and walker-on-walker are no-ops.

### Endings and winner

- The simulation ends when **all resources are claimed** OR **no humans remain alive**.
- A **maximum-turn cap** guarantees termination: without it, a board where the last
  resources are unreachable (ringed by walkers) while survivors still live would loop
  forever. The cap converts that into a scored result.
- Before the cap, a turn producing **no movement, no claim, and no death** is a frozen
  board — since movement is deterministic it would repeat forever, so the sim stops there
  and scores it rather than idling to the cap.
- Winner = the group with **more resources**. Ties break by survivors remaining, then an
  honest **draw**. If every human dies, the **walkers win**.

### Input, output, randomness, tooling

- **Input:** a JSON scenario file (grid size, seed, starting positions, config). The CLI
  takes a path; there is no interactive prompting. Format is flexible per the brief.
- **Output:** the winner plus enough to understand the run — a turn-by-turn event log and
  a grid render, not just a final verdict. The log reads as **dramatic, thematic narration**
  (it's a promotional companion piece), not dry telemetry.
- **Randomness:** a single **seeded PRNG** (not `Math.random`). Same seed → same run,
  which is what makes the sim testable and every playthrough defensible.
- **Decision-making is rule-based + seeded probability, never an in-loop LLM** — for
  determinism, cost/latency, and so every behaviour can be reasoned about and modified by
  hand (which the interview requires).
- **Stack:** TypeScript (strict) on Node.js 24 LTS, zero runtime dependencies, Vitest for
  tests. Functional core (pure simulation) / imperative shell (CLI + I/O).

---

## 2. What I'd improve with more time

With more time, I'd make the survivors smarter about danger. Right now they just walk straight at the nearest resource, even if a walker is standing in the way. 
That was on purpose for version 1 — simple movement is easy to follow and easy to test. But it means a Lab researcher, who only wins 40% of fights, 
keeps walking into fights they should avoid. I'd change the movement so cells near walkers count as "expensive," and each group avoids them
based on how likely they are to lose.  Also a bit more complex, but to make it more thematic, I would want to add reanimation — a survivor killed by a walker
turns into one on the next turn — adding more drama and escalating pressure to each run.

---

## 3. What I'm most proud of

I'm most proud that the simulation feels alive but stays repeatable. I leaned on the story when I made my choices — the Precinct fight like trained officers,
the Lab like desperate researchers (with a hint of adrenaline after the fire that wiped out their supplies), and the fights and deaths read like real Walking Dead moments, not dry numbers. 
So each "what if" plays out differently and feels original. But underneath, it's fully controlled: the same setup with the same seed gives the exact same game every time. 
I used a seeded random generator instead of plain random, so if a run throws up a surprising, dramatic story, I can replay it exactly instead of losing it. It feels 
unpredictable, yet I can always reproduce it.