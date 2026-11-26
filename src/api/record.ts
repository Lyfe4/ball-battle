// A player's record (ADR 0088): what Profile shows of their online series, read from the series
// that exist (nothing new is stored). Online series only, live and by turns; a bot's series are
// played on the device and never counted. A series counts once finished, a forfeit included (a
// loss for the side that left or ran out); a void series never counts.
import type { BestOf, Format } from '../sim/index.ts';

/** How many finished series GET /api/v1/me/record lists, the most recent first. */
export const RECENT_SERIES = 20;

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
  /** Rounds won by each side. */
  readonly score: { readonly you: number; readonly them: number };
  /** ISO 8601, the database's time. */
  readonly finishedAt: string;
  /** The ruleset it was played under: Watch again only where it replays here (`replaysHere`). */
  readonly ruleset: number;
}

/** GET /api/v1/me/record: an account's own record (ADR 0088). */
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
  /** The RECENT_SERIES most recently finished, the latest first. */
  readonly recent: readonly RecentSeries[];
}
