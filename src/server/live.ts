// The rules of a live series (ADR 0053), pure: what the clock has decided by now, and when each
// round fights. Every time is the database's (ms since the epoch), read with the series; nothing
// here looks at a host's clock. A live series is a series by turns with short deadlines: a pick
// that runs out is made at random, a player silent past the grace period loses, and both must
// arrive within the start window.
import {
  AWAY_AFTER_MS,
  GRACE_MS,
  LEAD_MS,
  PICK_SECONDS,
  roundWatchMs,
  START_WINDOW_MS,
} from '../api/live.ts';
import type { Side } from '../sim/index.ts';

/** What the clock decides from: a live series' times, by the database's clock. */
export interface LiveFacts {
  readonly now: number;
  readonly createdAt: number;
  readonly startedAt: number | null;
  /** When each player last asked about this series; null until they arrive. */
  readonly seen: Readonly<Record<Side, number | null>>;
  /** The current pick's deadline, once started; null when no pick is due. */
  readonly deadline: number | null;
}

export type EndReason = 'left' | 'disconnected' | 'start_missed';

/** The first thing the clock has decided and nobody has written yet. */
export type LiveEvent =
  /** Both players are here: the first pick phase opens. */
  | { readonly kind: 'start' }
  /** The pick due ran out at `at`: a random ball, locked as of then. */
  | { readonly kind: 'timeout'; readonly at: number }
  /** The series ends: `winner` (null when nobody arrived) by forfeit. */
  | { readonly kind: 'forfeit'; readonly winner: Side | null; readonly reason: EndReason };

const other = (side: Side): Side => (side === 'a' ? 'b' : 'a');
const SIDES: readonly Side[] = ['a', 'b'];

/** When a player last seen at `seen` loses for being away: the notice, then the grace period. */
export const forfeitAtOf = (seen: number): number => seen + AWAY_AFTER_MS + GRACE_MS;

/**
 * The earliest event due by `now` in an open live series, or undefined while nothing is due. Events
 * are taken in time order, so a pick that ran out before a player's grace ended is still made.
 */
export function nextLiveEvent(facts: LiveFacts): LiveEvent | undefined {
  const { now, seen } = facts;
  if (facts.startedAt === null) {
    if (seen.a !== null && seen.b !== null) return { kind: 'start' };
    if (now < facts.createdAt + START_WINDOW_MS) return undefined;
    const here = SIDES.find((side) => seen[side] !== null);
    return { kind: 'forfeit', winner: here ?? null, reason: 'start_missed' };
  }
  let first: { at: number; event: LiveEvent } | undefined;
  const consider = (at: number, event: LiveEvent) => {
    if (at <= now && (first === undefined || at < first.at)) first = { at, event };
  };
  if (facts.deadline !== null) {
    consider(facts.deadline, { kind: 'timeout', at: facts.deadline });
  }
  for (const side of SIDES) {
    const last = seen[side];
    if (last === null) continue;
    consider(forfeitAtOf(last), { kind: 'forfeit', winner: other(side), reason: 'disconnected' });
  }
  return first?.event;
}

/** A played round's Fight! and the end of its watching time at 1×. */
export interface FightTime {
  readonly round: number;
  readonly fightAt: number;
  readonly endsAt: number;
}

/**
 * The fights a move starts: each round LEAD_MS after the lock that completed it, or after the
 * previous fight ends (Reveal's last round, which needs no pick, plays straight after the one
 * before), and each lasting its watching time. `ticks` holds each round's attempts.
 */
export function fightTimes(
  rounds: readonly { readonly round: number; readonly ticks: readonly number[] }[],
  lockedAt: number,
  previousEnd: number | null,
): FightTime[] {
  const times: FightTime[] = [];
  let ready = Math.max(lockedAt, previousEnd ?? lockedAt);
  for (const { round, ticks } of rounds) {
    const fightAt = ready + LEAD_MS;
    const endsAt = fightAt + roundWatchMs(ticks);
    times.push({ round, fightAt, endsAt });
    ready = endsAt;
  }
  return times;
}

/** The next pick phase: it opens when the last fight ends (or at the lock), for PICK_SECONDS. */
export function pickPhase(
  lockedAt: number,
  fights: readonly FightTime[],
): { readonly opensAt: number; readonly deadline: number } {
  const opensAt = fights.at(-1)?.endsAt ?? lockedAt;
  return { opensAt, deadline: opensAt + PICK_SECONDS * 1000 };
}

/** A ball from those left, chosen by `random` (0 ≤ x < 1); undefined when none is left. */
export const randomBall = (left: readonly string[], random: number): string | undefined =>
  left[Math.min(left.length - 1, Math.floor(random * left.length))];

/** A random number from the platform's CSPRNG: nothing the opponent can steer or predict. */
export function secureRandom(): number {
  const [value = 0] = crypto.getRandomValues(new Uint32Array(1));
  return value / 2 ** 32;
}
