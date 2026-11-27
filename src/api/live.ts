// Live friend matches (ADR 0053): the clock both players keep, shared by the server (which sets
// every time by the database's clock) and the page (which only counts down to those times). A live
// series is a series by turns with short deadlines, fights the server schedules, and a forfeit for a
// player who stops asking.
import type { Format, Side } from '../sim/index.ts';

/** Seconds each pick has, from when its pick phase opens. Out of time: a random ball. */
export const PICK_SECONDS = 30;
/**
 * From the lock that completes a round to its Fight!: room for the other phone to learn of it (its
 * next read: measured up to 2.2 s from Ohio on a slow phone, ADR 0054), then the whole 3-2-1.
 */
export const LEAD_MS = 6_000;
/** The 3-2-1 at the end of the lead; before it the ready card says "Get ready". */
export const COUNTDOWN_MS = 3_000;
/**
 * Reveal's coin toss in a live match (ADR 0061): from the start, "Get ready" while the other phone
 * learns of it (as the lead into a fight), then the flip both phones play at once, then the result
 * held to be read. The first pick opens when it ends (`TOSS_LEAD_MS` after the start). Offline the
 * toss is the flip and the hold alone.
 */
export const TOSS_READY_MS = 3_000;
export const TOSS_FLIP_MS = 2_000;
export const TOSS_HOLD_MS = 1_500;
export const TOSS_LEAD_MS = TOSS_READY_MS + TOSS_FLIP_MS + TOSS_HOLD_MS;
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

/** Why a live series ended early: a deliberate leave, a player gone past the grace, a missed start. */
export type LiveEndReason = 'timeout' | 'left' | 'disconnected' | 'start_missed';

/**
 * A live series' clock as a player is sent it (`SeriesView.live`), by the database's time in ms
 * since the epoch. The database's clock at the read comes in the `X-Now` header of every answer
 * (the server sends it on a 304 too, but Netlify's edge drops it there: only a full answer is
 * sure to carry it, ADR 0061), so the page can keep its own clock's offset.
 */
export interface LiveView {
  /** When both players had arrived; null while waiting for the other one. */
  readonly startedAt: number | null;
  /** Whoever hasn't arrived by then loses. */
  readonly startBy: number;
  /** When the current pick phase opened (its deadline is the view's `deadline`). */
  readonly opensAt: number | null;
  /** Each played round's Fight! and the end of its watching time at 1x. */
  readonly fights: readonly {
    readonly round: number;
    readonly fightAt: number;
    readonly endsAt: number;
  }[];
  /** Picks the server made at random when their time ran out. */
  readonly auto: readonly { readonly round: number; readonly side: Side }[];
  /** The opponent has not asked for AWAY_AFTER_MS: since when, and when they lose. */
  readonly away: { readonly since: number; readonly forfeitAt: number } | null;
  readonly endReason: LiveEndReason | null;
}

/** GET /api/v1/me/match: the live match, lineup or lobby to go back to (home's "Back to your match"). */
export type CurrentMatch =
  | {
      readonly kind: 'series';
      readonly id: string;
      readonly format: Format;
      readonly bestOf: 3 | 5;
      readonly opponent: string | null;
    }
  | {
      readonly kind: 'lobby';
      readonly token: string;
      readonly format: Format;
      readonly bestOf: 3 | 5;
      /** The friend it waits for (ADR 0079 PR (d)), by name; null for a link to anyone. */
      readonly invitee: string | null;
      /**
       * How long after this answer the lobby stops unless its page is heard from again: home asks
       * again then, so "Back to your lobby" never outlives it. A duration: clocks differ.
       */
      readonly stopsInMs?: number;
    }
  /** Lineups being picked together (ADR 0080). */
  | {
      readonly kind: 'start';
      readonly id: string;
      readonly format: Format;
      readonly bestOf: 3 | 5;
    };

export interface CurrentMatchResponse {
  readonly match: CurrentMatch | null;
}

/** The `X-Now` header: the database's clock (ms since the epoch) when the answer was made. */
export const NOW_HEADER = 'X-Now';
