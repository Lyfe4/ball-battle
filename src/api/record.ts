// A player's record (ADR 0088, 0089): what Profile shows of their online series, read from the
// series that exist (nothing new is stored). Online series only, live and by turns; a bot's series
// are played on the device and never counted. A series counts once finished, a forfeit included (a
// loss for the side that left or ran out); a void series never counts.
import type { BestOf, Format } from '../sim/index.ts';

/** How many finished series GET /api/v1/me/record lists, the most recent first; also a page. */
export const RECENT_SERIES = 20;

/**
 * How a forfeit ended, from this player's side (ADR 0089): they or the other player left (or
 * disconnected, or was deleted), or their own or the other's time ran out (a turn by turns, a live
 * lineup never opened). Null when it was played out.
 */
export type Ending = 'youLeft' | 'theyLeft' | 'yourTime' | 'theirTime';

/** One finished online series, as its player sees it. */
export interface RecentSeries {
  /** The series: `?online=<id>` opens its own screen. */
  readonly id: string;
  /** The other player's name as this player sees it; null when they have been deleted. */
  readonly opponent: string | null;
  /** Played live (ADR 0053); else by turns (ADR 0085). */
  readonly live: boolean;
  readonly bestOf: BestOf;
  readonly format: Format;
  /** Won, or lost: a forfeit both sides missed is lost for both. */
  readonly won: boolean;
  /** Ended by a forfeit (a player left, disconnected, ran out of time or missed the start). */
  readonly forfeit: boolean;
  /** How a forfeit ended, from this player's side; null when played out (ADR 0089). */
  readonly ending: Ending | null;
  /** Rounds won by each side. */
  readonly score: { readonly you: number; readonly them: number };
  /** ISO 8601, the database's time. */
  readonly finishedAt: string;
  /** The ruleset it was played under: Watch again only where it replays here (`replaysHere`). */
  readonly ruleset: number;
}

/** Series won of series played, in one part of the record. */
export interface Tally {
  readonly wins: number;
  readonly played: number;
}

/** "Your stats" (ADR 0089): the record's breakdowns, from the same counted series. */
export interface RecordStats {
  readonly live: Tally;
  readonly turns: Tally;
  readonly bestOf3: Tally;
  readonly bestOf5: Tally;
  /** The most series won in a row, by when they finished. */
  readonly bestStreak: number;
  /** In how many of the player's series the favourite ball (the most played) was in the lineup. */
  readonly favouriteIn: number;
}

/** GET /api/v1/me/record: an account's own record (ADR 0088, 0089). */
export interface RecordResponse {
  /** Online series won. */
  readonly wins: number;
  /** Online series finished, forfeits included. */
  readonly played: number;
  /**
   * The ball in most of the player's online lineups (ties: the one in the most recent), as its id;
   * null before the first.
   */
  readonly favourite: string | null;
  readonly stats: RecordStats;
  /** The RECENT_SERIES most recently finished, the latest first. */
  readonly recent: readonly RecentSeries[];
  /** The cursor of the page after `recent` (GET /api/v1/me/matches?after=), null when none. */
  readonly next: string | null;
}

/** GET /api/v1/me/matches?after=<cursor>: the next RECENT_SERIES of All matches (ADR 0089). */
export interface MatchesPage {
  readonly matches: readonly RecentSeries[];
  /** The cursor of the page after this one, null at the end. */
  readonly next: string | null;
}
