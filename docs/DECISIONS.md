# Decision Log

A running record of the decisions behind the simulation and *why* each was made. This is
the living source of truth — it's updated as decisions are made or changed. The polished
narrative for the submission lives in [DESIGN.md](DESIGN.md).

## Toolchain and architecture

| Decision | Status | Rationale |
| --- | --- | --- |
| TypeScript (strict) on Node.js | `LOCKED` | Discriminated unions model the entity domain precisely; strict mode catches shape errors at build time. Type errors ≠ logic errors, so tests still carry logic correctness. |
| Node 24 LTS, pinned via `.nvmrc` | `LOCKED` | Current LTS ("Krypton"); reproducible environment without pinning a bleeding-edge runtime. |
| No Docker | `LOCKED` | Single program, one runtime dependency (Node) which is allowed. `.nvmrc` is sufficient; a container would be ceremony. |
| Zero runtime dependencies | `LOCKED` | Nothing here needs a library; keeps the surface auditable and the build trivial. |
| Functional core / imperative shell | `LOCKED` | Pure, deterministic simulation engine; side effects (I/O, CLI) at the edges. Makes the core unit-testable. |
| Single seeded PRNG (e.g. mulberry32), not `Math.random` | `LOCKED` | Reproducibility: same seed → same run. Enables golden tests and lets any playthrough be replayed and explained. `Math.random` can't be seeded. |
| Rule-based + seeded probability for decisions; **no in-loop LLM** | `LOCKED` | Determinism, cost/latency at scale, and defensibility — the interview modifies the sim by hand, so behaviour must be reasoned about, not delegated to an opaque model. An LLM could only add out-of-loop narrative flavour text. |

## Input / output

| Decision | Status | Rationale |
| --- | --- | --- |
| JSON scenario file as input; CLI takes a path (no interactive prompts) | `LOCKED` | Declarative, versionable, reproducible, and doubles as a test fixture. Console input is fiddly and unrepeatable. |
| Output = winner + turn-by-turn event log + grid render | `LOCKED` | Brief asks for "enough information to understand how the simulation played out," not just a verdict. |
| Event-log tone = dramatic, thematic narration | `LOCKED` | It's a promotional companion piece for the franchise — the play-by-play should read dramatically (thematic combat/claim/death/reanimation lines), not as dry telemetry. |

## Simulation rules

| Decision | Status | Rationale |
| --- | --- | --- |
| Activation = one action per entity per turn | `LOCKED` | Simple, fair, and matches "every living entity activates each turn." |
| Targeting: survivors → nearest resource; walkers → nearest survivor | `LOCKED` | The core behavioural spine of the sim. |
| Movement geometry: 4-directional (Manhattan) | `LOCKED` | One orthogonal step per turn — N/S/E/W, no diagonals (a chess "soldier" that may also step backward). Distance measured as `|dx|+|dy|`. Simplifies combat lines; diagonals add complexity with no thematic payoff. |
| Walkers always chase the nearest human (no random shambling) | `LOCKED` | Deliberately deterministic: chasing removes the noise a random-shamble model adds, keeping scenarios reproducible and the threat legible. Combat then becomes the *only* source of randomness. Walkers pick the nearest survivor by Manhattan distance, ties broken lowest x then y. A detection-radius/shamble model was considered and rejected to minimise randomness. |
| Survivors are danger-blind greedy in v1 | `LOCKED` | Simplest defensible baseline, and dramatic by design — survivors beeline to the nearest resource straight through danger. Danger-aware routing is the named "improve with more time." |
| Deterministic tiebreak: order by lower x, then lower y | `LOCKED` | Among equidistant candidate targets, pick the one with the lowest x, then lowest y. When a step could reduce distance on either axis, resolve the **x-axis first**, then y. Plain Cartesian ordering — predictable and reproducible. |
| Alternating group initiative; walkers act last | `LOCKED` | The two survivor groups swap who goes first each turn (turn 1: Lab → Precinct; turn 2: Precinct → Lab; alternating by turn parity), and walkers always move last. Removes any permanent first-mover advantage, so the only asymmetry is the lore-based combat edge, not turn order. |
| Combat resolves before resource claiming | `LOCKED` | You must survive a contested cell to claim what's on it; resolves the "touches the resource and gets attacked" case cleanly. |
| Move resolution: **sequential** (one entity at a time, in initiative order) | `LOCKED` | Each entity moves and resolves its interaction immediately before the next acts, so every clash is actually recorded and resolved. Also dissolves the swap/pass-through problem — you interact with whoever *currently* occupies the cell you enter, so two entities can never glide through each other. |
| **One mobile entity per cell** (resources are static overlays) | `LOCKED` | The board holds at most one walker-or-survivor per cell, so every interaction is a clean 1-mover-vs-1-occupant event — never a 3+ pile-up. Stepping onto a combat opponent (survivor↔walker) resolves by combat (loser removed, winner takes the cell); stepping onto a non-combat occupant (friendly survivor, rival survivor in v1, another walker) is **blocked** and the mover waits that turn. A survivor surrounded by walkers still faces each of them in sequence during the walker phase (each a clean 1-v-1) and must win every coin to live. |
| Within-group activation order: by **input index** | `LOCKED` | Survivors act in the order they appear in the scenario file (index 0 first). Deterministic and obvious; no hidden ordering. |

## Interactions (all type combinations)

| Interaction | Resolution | Status |
| --- | --- | --- |
| Survivor + Resource | Instant claim on co-location; resource removed, group score +1 | `LOCKED` |
| Survivor + Walker | Single seeded weighted coin; loser dies (no HP/health bar). **Asymmetric by lore:** Precinct win **60%** of walker fights, Lab win **40%** — the Lab's higher-than-instinct number is desperation/adrenaline, straight from the backstory. These odds are the *only* behavioural difference between the groups, and are easily tuned. | `LOCKED` |
| Rival survivor + rival survivor | **v1: no interaction (no-op)** — rivals ignore each other; a contested resource goes to whoever acts first (initiative). Non-lethal scuffle deferred to v2. | `LOCKED` (v1) |
| Dead human | **v1: removed from the board** — no reanimation. Rising as a walker next turn deferred to v2. | `LOCKED` (v1) |
| Walker + Resource | **v1: no interaction** — a walker does not block or guard a resource; a survivor who wins the cell's combat still claims it. Guarding deferred to v2. | `LOCKED` (v1) |
| Same-group survivors / walker + walker (non-combat pair) | **Cannot share a cell** — the mover is blocked and waits this turn (one mobile entity per cell). No combat, no stacking. | `LOCKED` |

**Asymmetric by lore** = giving the two groups different behaviour/stats drawn from the
backstory (Precinct = trained officers, strong in a fight; Lab = researchers, weak but
desperate) rather than treating them identically. This is the main thing that keeps the
solution distinguishable from a generic one.

## Endings and winner

| Decision | Status | Rationale |
| --- | --- | --- |
| End when all resources claimed OR no humans remain | `LOCKED` | Straight from the brief. |
| Maximum-turn cap — configurable, input-validated, default `4 × N²` | `LOCKED` | The two brief conditions don't prevent an infinite loop (e.g. last resources unreachable while survivors live). A configurable, validated cap forces a scored result. Default scales with grid area. The hard backstop. |
| Early stalemate stop: a turn with **no movement, no claim, and no death** ends the game | `LOCKED` | Movement is deterministic, so a fully frozen turn will repeat forever — detect it and stop immediately rather than idling to the cap. (Refined from an earlier "no claim for K turns" idea, which would false-positive during long resource approaches — normal travel produces many claim-less turns.) |
| Winner = most resources; tie → survivors remaining → draw; all humans dead → walkers win | `LOCKED` | The brief defines the *ending* but leaves *winner* logic to us. "Majority of resources" is a winner rule, not an ending condition. |

## Testing

| Decision | Status | Rationale |
| --- | --- | --- |
| Golden (scenario) tests as the backbone + thin unit tests on tricky pure functions | `LOCKED` | Scenario tests assert `scenario + seed → winner/events`; unit tests (tiebreak, combat, boundary clamping, interaction matrix) localize failures. Marked good-to-have in priority, but production quality expects them. |

## Deferred to v2 (consciously out of scope for v1)

Considered and deliberately cut to keep v1 a clean, defensible baseline. Doubles as the
"what I'd improve with more time" backlog:

- **Danger-aware pathfinding** — survivors route around walkers instead of beelining.
- **Reanimation** — dead humans rise as walkers the next turn (escalating horde pressure).
- **Rival scuffle** — non-lethal knockback when rival survivors collide (Precinct favoured).
- **Walkers guarding resources** — a walker on a resource blocks the claim until cleared.
- **Walker detection radius** — random shamble until a survivor comes within sensing range.
