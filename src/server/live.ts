// PROTOTYPE (proto/live-friend-matches, ADR 0053 draft): live friend matches on the series machine.
// Pure: the timings of a live series from what is stored (the time each pick was locked, the
// rounds played) and the database's clock. Nothing here is a new rule of the sim: a live series is
// the same series by turns, with short deadlines, fights scheduled by the server, and a forfeit for
// a player who stops asking.
import type { RoundRecord } from '../sim/index.ts';
import type { FrozenSim } from './rulesets.ts';

/** Seconds a player has for each pick once the pick phase opens. */
export const PICK_SECONDS = 30;
/** From the lock that completes a round to its Fight!: both screens learn of it and get ready. */
export const LEAD_MS = 3_000;
/** A player not heard from for this long is shown as disconnected to the other one. */
export const AWAY_AFTER_MS = 6_000;
/** Then this long to come back before the other player wins by forfeit. */
export const GRACE_MS = 30_000;
/** Before the first pick: both players arrive on the series screen. */
export const START_MS = 3_000;

/**
 * How long a round takes to watch at normal speed, generously: every attempt's ticks, its intro
 * and knockout, hit-stops and slow-mo. The next pick phase opens after it on both screens.
 * Prototype: replayed here and cached per instance; the real thing stores it with the round.
 */
const INTRO_MS = 1_100;
const ENDING_MS = 3_500;
const FEEL_ALLOWANCE = 1.08;
const cache = new Map<string, number>();

export function fightMsOf(sim: FrozenSim, key: string, round: RoundRecord, a: string, b: string) {
  const known = cache.get(key);
  if (known !== undefined) return known;
  let ms = 0;
  for (const seed of round.seeds) {
    const end = sim.playToEnd(sim.matchWorld({ round: round.round, attempt: 0, a, b, seed }));
    ms += INTRO_MS + (end.tick * 1000 * FEEL_ALLOWANCE) / 60 + ENDING_MS;
  }
  if (round.suddenDeath) ms += ENDING_MS;
  const rounded = Math.ceil(ms / 500) * 500;
  cache.set(key, rounded);
  return rounded;
}

/** One round's fight on the server's clock (ms since the epoch). */
export interface Fight {
  readonly round: number;
  readonly at: number;
  readonly endsAt: number;
}

/**
 * Every played round's Fight! and end: a round whose picks were locked at `lockedAt` fights
 * LEAD_MS later, and a round that needed no pick (Reveal's last) LEAD_MS after the one before ends.
 */
export function fightsOf(
  rounds: readonly RoundRecord[],
  lockedAt: (round: number) => number | undefined,
  fightMs: (round: RoundRecord) => number,
): Fight[] {
  const fights: Fight[] = [];
  let lastEnd = -Infinity;
  let lastLock = -Infinity;
  for (const round of rounds) {
    const lock = lockedAt(round.round) ?? lastLock;
    const at = Math.max(lock, lastEnd) + LEAD_MS;
    const endsAt = at + fightMs(round);
    fights.push({ round: round.round, at, endsAt });
    lastEnd = endsAt;
    lastLock = lock;
  }
  return fights;
}

/** The seconds from a move's write to the next pick's deadline, for the rounds it played. */
export function deadlineAfter(played: readonly number[]): number {
  let ms = 0;
  for (const fight of played) ms += LEAD_MS + fight;
  return (ms + PICK_SECONDS * 1000) / 1000;
}
