// Live friend matches (ADR 0053): the clock both players keep, shared by the server (which sets
// every time by the database's clock) and the page (which only counts down to those times). A live
// series is a series by turns with short deadlines, fights the server schedules, and a forfeit for a
// player who stops asking.
import type { Format } from '../sim/index.ts';

/** Seconds each pick has, from when its pick phase opens. Out of time: a random ball. */
export const PICK_SECONDS = 30;
/** From the lock that completes a round to its Fight!, so both screens learn of it first. */
export const LEAD_MS = 3_000;
/** A player not heard from for this long shows as disconnected to the other. */
export const AWAY_AFTER_MS = 6_000;
/** Then this long to come back before losing by forfeit. */
export const GRACE_MS = 30_000;
/** From the friend's Accept, both players have this long to arrive; whoever hasn't loses. */
export const START_WINDOW_MS = 60_000;
/** A sender's lobby stays open while their page has asked within this long. */
export const LOBBY_SEEN_MS = 60_000;

/** Live play is offered in these formats only: Blind live is two players watching (decision 4). */
export const LIVE_FORMATS: readonly Format[] = ['reveal', 'showdown'];

/**
 * The longest one fight's attempt takes to watch at normal speed (1×), from its Fight! to the end of
 * its winner's celebration: the whole intro, every tick with an allowance for hit-stops and the
 * knockout's slow-mo, and the knockout's ending. Generous by design: the next pick opens at this
 * time on both screens, so it must never come before a page has finished showing the fight.
 * `live-watch.test.ts` checks it against the page's own presentation of every known match.
 */
export function attemptWatchMs(ticks: number): number {
  return Math.ceil(INTRO_MS + ticks * TICK_WATCH_MS + ENDING_MS);
}

/** A round's watching time: each attempt (a draw is fought again) one after the other. */
export const roundWatchMs = (attemptTicks: readonly number[]): number =>
  attemptTicks.reduce((total, ticks) => total + attemptWatchMs(ticks), 0);

/** The intro the page plays before a fight's first tick (`theme.introMs`, rounded up). */
const INTRO_MS = 1_200;
/** One tick at 60 Hz, plus 10% for hit-stops. */
const TICK_WATCH_MS = (1000 / 60) * 1.1;
/** The knockout: its slow-mo, the result's delay and the winner's celebration, with a margin. */
const ENDING_MS = 2_600;
