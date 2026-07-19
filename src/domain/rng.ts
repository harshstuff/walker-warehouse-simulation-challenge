/**
 * A seeded pseudo-random generator. The same seed always produces the same stream of
 * numbers, which is the single most important property in this codebase: it makes every
 * run reproducible, every golden test possible, and every playthrough explainable.
 *
 * Implementation is mulberry32 — tiny, fast, and statistically fine for a game simulation
 * (it is NOT cryptographically secure, and doesn't need to be).
 */
export interface Rng {
  /** The next float in [0, 1), advancing the stream by one step. */
  next(): number;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return {
    next(): number {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** Returns true with probability `p` (clamped to [0, 1]), consuming one value from the stream. */
export function chance(rng: Rng, p: number): boolean {
  return rng.next() < p;
}
