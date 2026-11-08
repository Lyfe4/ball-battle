// The intended counter map (ADR 0010, docs/vision.md): for every pair of balls, which side should
// be favoured, or whether it should be even, and why. Plain data in the sim, because a bot reads it
// to counter-pick (ADR 0019); `pnpm balance` checks each pair against its band
// (scripts/counter-map.ts). A new ball adds one entry per existing ball in the file for its batch;
// a test checks the map covers every pair.
import { BATCH_THREE_ENTRIES } from './counter-map-batch-3.ts';
import { BATCH_FOUR_ENTRIES } from './counter-map-batch-4.ts';
import { BATCH_FIVE_ENTRIES } from './counter-map-batch-5.ts';
import { FIRST_ENTRIES } from './counter-map-first.ts';
import { HIT_KIND_CHRONO_GUARDIAN_ENTRIES } from './counter-map-hit-kinds-chrono-guardian.ts';
import { HIT_KIND_GHOST_BLOOM_VENOM_ENTRIES } from './counter-map-hit-kinds-ghost-bloom-venom.ts';
import { RULES_OUT_ARCHER_SNIPER_ENTRIES } from './counter-map-rules-out-archer-sniper.ts';
import { RULES_OUT_BERSERKER_VAMPIRE_ENTRIES } from './counter-map-rules-out-berserker-vampire.ts';
import { RULES_OUT_BOOMERANG_ENTRIES } from './counter-map-rules-out-boomerang.ts';
import { RULES_OUT_STORM_QUAKE_ENTRIES } from './counter-map-rules-out-storm-quake.ts';

/** Which side of a pair should win more: the first ball, the second, or neither. */
export type Intended = 'x' | 'y' | 'even';

/**
 * How sharp a favoured pair is meant to be (ADR 0045): `kind` when a kind of hit decides it (spikes
 * against bumps, a rewind against a big hit, lifesteal against shots), `movement` when speed, size,
 * range, a pull or minions in the way do. Kind counters are binary and sharper.
 */
export type CounterBand = 'kind' | 'movement';

export interface CounterEntry {
  readonly x: string;
  readonly y: string;
  readonly intended: Intended;
  /** Set on every favoured pair, never on an even one (a test checks). */
  readonly band?: CounterBand;
  /** Why, in one line, from the two balls' identities. */
  readonly reason: string;
}

/** Every pair of balls exactly once, with its intended result and why (a test checks coverage). */
export const COUNTER_MAP: readonly CounterEntry[] = [
  ...FIRST_ENTRIES,
  ...BATCH_THREE_ENTRIES,
  ...BATCH_FOUR_ENTRIES,
  ...BATCH_FIVE_ENTRIES,
  ...RULES_OUT_STORM_QUAKE_ENTRIES,
  ...RULES_OUT_BERSERKER_VAMPIRE_ENTRIES,
  ...RULES_OUT_ARCHER_SNIPER_ENTRIES,
  ...RULES_OUT_BOOMERANG_ENTRIES,
  ...HIT_KIND_CHRONO_GUARDIAN_ENTRIES,
  ...HIT_KIND_GHOST_BLOOM_VENOM_ENTRIES,
];

/** The map entry for a pair, whichever order the pair comes in. */
export function counterFor(a: string, b: string): CounterEntry | undefined {
  return COUNTER_MAP.find(
    (entry) => (entry.x === a && entry.y === b) || (entry.x === b && entry.y === a),
  );
}

/** True when the map says `ball` is favoured against `opponent` (it counters it). */
export function isFavoured(ball: string, opponent: string): boolean {
  const entry = counterFor(ball, opponent);
  if (entry === undefined || entry.intended === 'even') return false;
  return (entry.intended === 'x' ? entry.x : entry.y) === ball;
}
