import type { Position } from "../domain/position.js";
import type { Faction } from "../domain/entities.js";

/**
 * A structured record of something noteworthy that happened during a turn. The engine
 * emits these; the io layer narrates them. Only the dramatic beats are events — routine
 * movement is conveyed by the per-turn grid snapshot, not the log.
 *
 * (A `combat` event with `survivorWon: false` is also the record of a survivor's death;
 * with `survivorWon: true` it records a walker's death. There are no other death causes
 * in v1 — no reanimation.)
 */
export type SimEvent =
  | {
      readonly kind: "claim";
      readonly survivorId: string;
      readonly faction: Faction;
      readonly at: Position;
      readonly labTotal: number;
      readonly precinctTotal: number;
    }
  | {
      readonly kind: "combat";
      readonly survivorId: string;
      readonly faction: Faction;
      readonly walkerId: string;
      readonly at: Position;
      readonly survivorWon: boolean;
    };
