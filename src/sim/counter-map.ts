// The intended counter map (ADR 0010, 0073, docs/vision.md): for every pair of balls, which side
// is favoured and by how much (a strong counter or an edge), or that it is even, and why. Plain data in the sim, because a bot reads it
// to counter-pick (ADR 0019); `pnpm balance` checks each pair against its band
// (scripts/counter-map.ts). A new ball adds one entry per existing ball in the file for its batch;
// a test checks the map covers every pair.
import { BATCH_THREE_ENTRIES } from './counter-map-batch-3.ts';
import { BATCH_FOUR_ENTRIES } from './counter-map-batch-4.ts';
import { BATCH_FIVE_ENTRIES } from './counter-map-batch-5.ts';
import { FIRST_ENTRIES } from './counter-map-first.ts';
import { HIT_KIND_CHRONO_ENTRIES } from './counter-map-hit-kinds-chrono.ts';
import { HIT_KIND_GHOST_BLOOM_VENOM_ENTRIES } from './counter-map-hit-kinds-ghost-bloom-venom.ts';
import { RULES_OUT_ARCHER_SNIPER_ENTRIES } from './counter-map-rules-out-archer-sniper.ts';
import { RULES_OUT_BERSERKER_VAMPIRE_ENTRIES } from './counter-map-rules-out-berserker-vampire.ts';
import { RULES_OUT_BOOMERANG_ENTRIES } from './counter-map-rules-out-boomerang.ts';
import { RULES_OUT_STORM_QUAKE_ENTRIES } from './counter-map-rules-out-storm-quake.ts';
import { GHOST_ENTRIES } from './counter-map-ghost.ts';
import { HEX_ENTRIES } from './counter-map-hex.ts';
import { SPIDER_ENTRIES } from './counter-map-spider.ts';
import { SPARTAN_ENTRIES } from './counter-map-spartan.ts';
import { BATTERY_ENTRIES } from './counter-map-battery.ts';
import { SLIME_ENTRIES } from './counter-map-slime.ts';
import { BALLOON_ENTRIES } from './counter-map-balloon.ts';
import { BANSHEE_ENTRIES } from './counter-map-banshee.ts';
import { KRAKEN_ENTRIES } from './counter-map-kraken.ts';
import { MIRAGE_ENTRIES } from './counter-map-mirage.ts';
import { JOUSTER_ENTRIES } from './counter-map-jouster.ts';
import { MINOTAUR_ENTRIES } from './counter-map-minotaur.ts';

/** Which side of a pair should win more: the first ball, the second, or neither. */
export type Intended = 'x' | 'y' | 'even';

/**
 * How far the favoured ball is ahead (ADR 0073): a strong counter wins 65% or more of the full
 * run, an edge 58% up to 65%. Under 58% a pair is even. One rule labels every pair.
 */
export type Level = 'strong' | 'edge';

interface EntryBase {
  readonly x: string;
  readonly y: string;
  /** Why, in one line, from the two balls' identities. */
  readonly reason: string;
}

export type CounterEntry = EntryBase &
  ({ readonly intended: 'even' } | { readonly intended: 'x' | 'y'; readonly level: Level });

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
  ...HIT_KIND_CHRONO_ENTRIES,
  ...HIT_KIND_GHOST_BLOOM_VENOM_ENTRIES,
  ...SPARTAN_ENTRIES,
  ...HEX_ENTRIES,
  ...SPIDER_ENTRIES,
  ...GHOST_ENTRIES,
  ...BATTERY_ENTRIES,
  ...SLIME_ENTRIES,
  ...BALLOON_ENTRIES,
  ...BANSHEE_ENTRIES,
  ...KRAKEN_ENTRIES,
  ...MIRAGE_ENTRIES,
  ...JOUSTER_ENTRIES,
  ...MINOTAUR_ENTRIES,
];

/** The map entry for a pair, whichever order the pair comes in. */
export function counterFor(a: string, b: string): CounterEntry | undefined {
  return COUNTER_MAP.find(
    (entry) => (entry.x === a && entry.y === b) || (entry.x === b && entry.y === a),
  );
}

/** A pair's favoured ball and its level, or undefined for an even pair (or a mirror). */
export function matchupOf(
  a: string,
  b: string,
): { readonly favoured: string; readonly level: Level } | undefined {
  const entry = a === b ? undefined : counterFor(a, b);
  if (entry === undefined || entry.intended === 'even') return undefined;
  return { favoured: entry.intended === 'x' ? entry.x : entry.y, level: entry.level };
}

/**
 * `ball`'s level against `opponent` as a number: 2 a strong counter, 1 an edge, 0 even, -1 an
 * edge against, -2 a strong counter against. What the bots rank and value by.
 */
export type Standing = -2 | -1 | 0 | 1 | 2;

export function standingOf(ball: string, opponent: string): Standing {
  const matchup = matchupOf(ball, opponent);
  if (matchup === undefined) return 0;
  const size = matchup.level === 'strong' ? 2 : 1;
  return matchup.favoured === ball ? size : size === 2 ? -2 : -1;
}

/** True when the map says `ball` is favoured against `opponent`, at either level. */
export function isFavoured(ball: string, opponent: string): boolean {
  const entry = counterFor(ball, opponent);
  if (entry === undefined || entry.intended === 'even') return false;
  return (entry.intended === 'x' ? entry.x : entry.y) === ball;
}
